"""Two bounded continuation rounds; uses FLOAT checkpoints, not installed
integer weights. All artifacts stay in the isolated experiment directory.
"""
import concurrent.futures, gzip, hashlib, importlib.util, json, re, subprocess, time
from pathlib import Path
spec=importlib.util.spec_from_file_location('trainer',Path(__file__).with_name('train-technical-tesseract.py'))
trainer=importlib.util.module_from_spec(spec);spec.loader.exec_module(trainer)
OUT=trainer.OUT;STUDY=OUT/'feedback-study-v1'

def main():
    m=json.loads((STUDY/'manifest.json').read_text(encoding='utf8'))
    if (STUDY/'training-report.json').exists():raise RuntimeError('Completed experiment exists')
    assert m['realUserCorrections']==0 and len(m['splits']['holdout'])==40
    rows=m['splits']['feedback']+m['splits']['validation']
    for r in rows:
        if not r['file'].startswith(('feedback-study-v1/feedback/','feedback-study-v1/validation/')):raise RuntimeError('Unexpected training image')
        if hashlib.sha256((OUT/r['file']).with_suffix('.png').read_bytes()).hexdigest()!=r['sha256']:raise RuntimeError('Image changed')
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(trainer.encode,rows))
    def listfile(path,items):path.write_text('\n'.join(Path(r['file']).with_suffix('.lstmf').as_posix() for r in items)+'\n',encoding='utf8',newline='\n')
    validation=STUDY/'list.validation';listfile(validation,m['splits']['validation'])
    checkpoint=OUT/'runs/balanced-v2/checkpoints/asmtech_0.638_1395_9700.checkpoint'
    proto=OUT/'runs/balanced-v2/proto/asmtech/asmtech.traineddata'
    reports=[]
    for round_number in [1,2]:
        folder=STUDY/f'round{round_number}-bounded';folder.mkdir(exist_ok=True)
        # Transfer only the float network, not a trainer's optimizer/counters.
        # Each batch gets an explicit, bounded 1600-step budget from zero.
        float_model=folder/'continuation.traineddata'
        trainer.run('lstmtraining',['--stop_training','--continue_from',checkpoint,'--traineddata',proto,'--model_output',float_model])
        trainer.run('combine_tessdata',['-u',float_model,folder/'continuation.'])
        float_info=trainer.run('combine_tessdata',['-l',float_model])
        if 'int_mode=0' not in float_info:raise RuntimeError('Cannot learn from quantized inference weights')
        confirmed=m['splits']['feedback'][:100*round_number]
        # Rehearse previous examples to measure/limit catastrophic forgetting.
        training=confirmed*3+m['replay'];listfile(folder/'list.train',training)
        limit=1600
        args=['--debug_interval','0','--traineddata',proto,'--continue_from',folder/'continuation.lstm','--learning_rate','0.0001','--reset_learning_rate','--model_output',folder/'asmtech','--train_listfile',folder/'list.train','--eval_listfile',validation,'--max_iterations',str(limit),'--target_error_rate','0.01','--max_image_MB','256']
        started=time.perf_counter()
        with (folder/'training-run.log').open('w',encoding='utf8') as log:
            process=subprocess.Popen([str(trainer.TOOLS/'lstmtraining.exe'),*map(trainer.native_arg,args)],cwd=OUT,env=trainer.ENV,creationflags=trainer.FLAGS,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
            for raw in iter(process.stdout.readline,b''):
                text=raw.decode('utf8',errors='replace');log.write(text);log.flush()
                if 'At iteration' in text or 'Error' in text:print(f'Round {round_number}: '+text.strip(),flush=True)
            if process.wait():raise RuntimeError('Feedback training failed')
        checkpoint=folder/'asmtech_checkpoint';candidate=folder/'asmtech.traineddata'
        trainer.run('lstmtraining',['--stop_training','--continue_from',checkpoint,'--traineddata',proto,'--convert_to_int','--model_output',candidate])
        network=trainer.run('combine_tessdata',['-l',candidate]);evaluation=trainer.run('lstmeval',['--model',candidate,'--eval_listfile',validation,'--verbosity','0'],120)
        packed=gzip.compress(candidate.read_bytes(),compresslevel=9,mtime=0);candidate.with_suffix('.traineddata.gz').write_bytes(packed)
        reports.append({'round':round_number,'iterationBudget':limit,'uniqueFeedbackExamples':len(confirmed),'replayExamples':len(m['replay']),'trainingSeconds':time.perf_counter()-started,'validation':evaluation,'network':network,'modelSha256':hashlib.sha256(packed).hexdigest(),'testImagesTrained':0,'realUserCorrections':0})
        print(json.dumps(reports[-1]),flush=True)
    (STUDY/'training-report.json').write_text(json.dumps({'synthetic':True,'productionEnabled':False,'rounds':reports},indent=2),encoding='utf8')

if __name__=='__main__':main()
