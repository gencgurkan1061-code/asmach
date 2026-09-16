"""Real Tesseract LSTM fine-tuning, not the experimental glyph classifier.
Uses the official tesstrain line-box/proto-model workflow without requiring
make/bash. Keeps all tools/training data outside the production package.
"""
import argparse, concurrent.futures, ctypes, gzip, hashlib, json, os, re, subprocess, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'/'tesseract-finetune'
TOOLS=ROOT/'outputs'/'tesseract-training-tools'/'tesseract-5.5.0'
ENV={**os.environ,'OMP_THREAD_LIMIT':'2','OMP_NUM_THREADS':'2'}
FLAGS=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
if os.name=='nt':ctypes.windll.kernel32.SetErrorMode(0x0001|0x0002|0x8000)

def native_arg(value):
    # The Windows training executables use narrow argv for data paths. Relative
    # ASCII corpus paths avoid corrupting a Turkish workspace directory name.
    return os.path.relpath(value,OUT).replace('\\','/') if isinstance(value,Path) else str(value)

def run(tool,args,timeout=90):
    p=subprocess.run([str(TOOLS/(tool+'.exe')),*map(native_arg,args)],cwd=str(OUT),env=ENV,creationflags=FLAGS,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout)
    text=p.stdout.decode('utf-8',errors='replace')
    if p.returncode:raise RuntimeError(f'{tool} exited {p.returncode}: {text[-2500:]}')
    return text

def encode(row):
    base=OUT/row['file'];target=base.with_suffix('.lstmf')
    if target.exists() and target.stat().st_size>0:return
    log=run('tesseract',[base.with_suffix('.png'),base,'--tessdata-dir',OUT/'starter','--psm','13',TOOLS/'tessdata/configs/lstm.train'],45)
    if not target.exists():raise RuntimeError('No lstmf for '+row['file']+': '+log)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--iterations',type=int,default=3500);ap.add_argument('--prepare-only',action='store_true');ap.add_argument('--corpus',default='corpus-manifest.json');ap.add_argument('--run');args=ap.parse_args()
    if Path(args.corpus).name!=args.corpus:raise RuntimeError('Corpus must be a manifest filename in the training output directory')
    if args.run and not re.fullmatch(r'[a-z0-9-]+',args.run):raise RuntimeError('Invalid run name')
    work=OUT/'runs'/args.run if args.run else OUT;work.mkdir(parents=True,exist_ok=True)
    if (work/'training-report.json').exists():raise RuntimeError('Completed run exists; choose another --run name to preserve evidence')
    corpusfile=OUT/args.corpus;corpus=json.loads(corpusfile.read_text(encoding='utf-8'))
    assert set(corpus['splits'])=={'train','validation'}
    assert not set(corpus['fontSplits']['train'])&set(corpus['fontSplits']['holdout'])
    for split,rows in corpus['splits'].items():
        allowed=('corpus/train/','corpus/balanced-v2/') if split=='train' else ('corpus/validation/',)
        if any(not r['file'].startswith(allowed) or '..' in Path(r['file']).parts for r in rows):raise RuntimeError('Training paths include non-training material')
    starter=OUT/'starter';proto=work/'proto';proto.mkdir(exist_ok=True)
    gt=work/'all-gt.txt';gt.write_text('\n'.join(r['text'] for r in corpus['splits']['train'])+'\n',encoding='utf-8')
    setup=[]
    setup.append(run('unicharset_extractor',['--output_unicharset',proto/'new.unicharset','--norm_mode','2',gt]))
    setup.append(run('merge_unicharsets',[starter/'eng.lstm-unicharset',proto/'new.unicharset',proto/'unicharset']))
    setup.append(run('combine_lang_model',['--input_unicharset',proto/'unicharset','--script_dir',starter/'langdata','--output_dir',proto,'--lang','asmtech']))
    (work/'prepare.log').write_text('\n'.join(setup),encoding='utf-8')
    allrows=corpus['splits']['train']+corpus['splits']['validation'];started=time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for i,_ in enumerate(pool.map(encode,allrows),1):
            if i%250==0:print(f'Encoded {i}/{len(allrows)} training/validation lines',flush=True)
    for split,rows in corpus['splits'].items():
        (work/f'list.{split}').write_text('\n'.join(str(Path(r['file']).with_suffix('.lstmf')).replace('\\','/') for r in rows)+'\n',encoding='utf-8',newline='\n')
    print(f'Prepared {len(allrows)} lines in {time.perf_counter()-started:.1f}s; holdout excluded',flush=True)
    if args.prepare_only:return
    checkpoints=work/'checkpoints';checkpoints.mkdir(exist_ok=True);model=checkpoints/'asmtech';traineddata=proto/'asmtech'/'asmtech.traineddata'
    parameters=['--debug_interval','0','--traineddata',traineddata,'--old_traineddata',starter/'eng.traineddata','--continue_from',starter/'eng.lstm','--learning_rate','0.0001','--model_output',model,'--train_listfile',work/'list.train','--eval_listfile',work/'list.validation','--max_iterations',str(args.iterations),'--target_error_rate','0.01','--max_image_MB','512']
    started=time.perf_counter();logpath=work/'training.log'
    with logpath.open('w',encoding='utf-8') as log:
        proc=subprocess.Popen([str(TOOLS/'lstmtraining.exe'),*map(native_arg,parameters)],cwd=str(OUT),env=ENV,creationflags=FLAGS,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        for data in iter(proc.stdout.readline,b''):
            text=data.decode('utf-8',errors='replace');log.write(text);log.flush()
            if 'iteration' in text or 'Error' in text or 'Failed' in text or 'Encoding' in text:print(text.strip(),flush=True)
        code=proc.wait()
    if code:raise RuntimeError(f'Trainer exited {code}; see {logpath}')
    checkpoint=Path(str(model)+'_checkpoint')
    if not checkpoint.exists():raise RuntimeError('Trainer produced no checkpoint')
    selection=[]
    if args.run:
        # Choose by the 200-line validation split, never by the locked 100
        # measurement test. Checkpoints are evaluated after integer export,
        # exactly the representation used by the app.
        available=sorted(checkpoints.glob('*.checkpoint'),key=lambda p:int(p.stem.split('_')[-1]))
        options=[]
        for fraction in [.25,.5,.75,1]:
            eligible=[p for p in available if int(p.stem.split('_')[-1])<=args.iterations*fraction]
            if eligible and eligible[-1] not in options:options.append(eligible[-1])
        options.append(checkpoint)
        for index,p in enumerate(options):
            exported=work/f'validation-checkpoint-{index}.traineddata'
            run('lstmtraining',['--stop_training','--continue_from',p,'--traineddata',traineddata,'--convert_to_int','--model_output',exported])
            result=run('lstmeval',['--model',exported,'--eval_listfile',work/'list.validation','--verbosity','0'],300)
            match=re.search(r'BCER eval=([\d.]+)',result)
            if not match:raise RuntimeError('No validation character error in '+result)
            selection.append({'checkpoint':p.relative_to(OUT).as_posix(),'bcer':float(match.group(1)),'evaluation':result})
            print(f'Validation checkpoint {index+1}/{len(options)}: BCER {match.group(1)}%',flush=True)
        best=min(selection,key=lambda row:row['bcer']);checkpoint=OUT/best['checkpoint']
    candidate=work/'asmtech.traineddata'
    export=run('lstmtraining',['--stop_training','--continue_from',checkpoint,'--traineddata',traineddata,'--convert_to_int','--model_output',candidate])
    info=run('combine_tessdata',['-l',candidate]);evaluation=run('lstmeval',['--model',candidate,'--eval_listfile',work/'list.validation','--verbosity','0'],300)
    payload=candidate.read_bytes();gz=gzip.compress(payload,compresslevel=9,mtime=0);(work/'asmtech.traineddata.gz').write_bytes(gz)
    report={'schema':1,'kind':'Tesseract-LSTM-finetune','trainingSeconds':time.perf_counter()-started,'maxIterations':args.iterations,'trainingLines':len(corpus['splits']['train']),'validationLines':len(corpus['splits']['validation']),'holdoutLinesUsedForTraining':0,'corpusSha256':hashlib.sha256(corpusfile.read_bytes()).hexdigest(),'holdoutManifestSha256':corpus['holdoutManifestSha256'],'sha256':hashlib.sha256(payload).hexdigest(),'gzipSha256':hashlib.sha256(gz).hexdigest(),'bytes':len(payload),'gzipBytes':len(gz),'network':info,'validation':evaluation,'validationSelection':selection,'selectedCheckpoint':checkpoint.relative_to(OUT).as_posix(),'export':export,'productionEnabled':False}
    (work/'training-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=True),flush=True)

if __name__=='__main__':main()
