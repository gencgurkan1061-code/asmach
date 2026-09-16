"""Balanced augmentation for training only. The locked 100-case set is read
only to exclude duplicate transcriptions; none of its images/fonts are used.
The original 200 validation lines remain unchanged for checkpoint selection.
"""
import hashlib, importlib.util, json, random
from pathlib import Path

spec=importlib.util.spec_from_file_location('corpus',Path(__file__).with_name('generate-ocr-100-corpus.py'))
corpus=importlib.util.module_from_spec(spec);spec.loader.exec_module(corpus)
OUT=corpus.OUT
EXTRA_FONTS=['arialbd.ttf','timesbd.ttf','courbd.ttf','couri.ttf','calibril.ttf','Candara.ttf','georgia.ttf','bahnschrift.ttf','framd.ttf']

def sample(rng,index):
    # Equal representation of symbols, zero-sided tolerances, fractional and
    # metric threads, fits, roughness and context text. Values are independent
    # random drawing-like examples, not a standards lookup table.
    n=f'{rng.uniform(.05,180):.{rng.choice([1,2,3])}f}'
    t=f'{rng.uniform(.001,.45):.{rng.choice([2,3])}f}'
    family=index%10
    if family==0:return rng.choice(['','Ø','R'])+n+' ±'+t
    if family==1:return n+'° '+rng.choice(['±'+t+'°','+1°/-'+t+'°','±'+str(rng.randint(1,59))+'′'])
    if family==2:return rng.choice(['','Ø','R'])+n+' '+rng.choice(['0/-'+t,'+'+t+'/0','(-'+t+'/-0.01)','(+0.4/+'+t+')'])
    if family==3:return rng.choice(['Ø','R','C'])+n+rng.choice(['',' THRU',' x 12 DEEP',' ±'+t])
    if family==4:return rng.choice(['M','Tr'])+str(rng.randint(3,70))+'x'+rng.choice(['0.5','0.75','1.0','1.25','1.5','2.0','3'])+rng.choice(['-6H','-6g',''])
    if family==5:return rng.choice(['#'+str(rng.randint(1,12)),str(rng.randint(1,13))+'/'+rng.choice(['16','32','64'])])+'-'+str(rng.randint(11,40))+' '+rng.choice(['UNC-2B','UNF-2A','UNEF-3B','NPT','NPTF','NPSM'])
    if family==6:return n+' '+rng.choice(['H7','h6','JS7','g6','H8','H7/g6','x 45°','x 30°'])
    if family==7:return rng.choice(['Ra ','Rz ','Rq ','Rt ','Rmax '])+n+rng.choice(['',' µm',' µin',' MAX'])
    if family==8:return rng.choice(['G ','Rc ','Rp ','R '])+str(rng.randint(1,21))+'/'+rng.choice(['8','16','32'])+rng.choice(['',' A',' LH'])
    return rng.choice(['DATUM ','NOTE ','MATERIAL ','DEPTH ','COATING ','LIMIT ','MIN ','MAX '])+rng.choice(['A','B','C','D','E','K','N','P','µm','in'])+' '+n

def main():
    original=json.loads((OUT/'corpus-manifest.json').read_text(encoding='utf8'))
    holdout=json.loads((OUT/'holdout-100/manifest.json').read_text(encoding='utf8'))
    fonts=original['fontSplits']['train']+EXTRA_FONTS
    assert not set(fonts)&set(holdout['fontFamilies'])
    assert not set(fonts)&set(original['fontSplits']['validation'])
    for font in fonts:
        if not (corpus.FONTS/font).exists():raise RuntimeError('Missing local font '+font)
    normalize=lambda s:s.lower().replace(' ','')
    seen={normalize(c['text']) for c in holdout['cases']}
    for rows in original['splits'].values():seen.update(normalize(r['text']) for r in rows)
    folder=OUT/'corpus'/'balanced-v2';folder.mkdir(parents=True,exist_ok=True)
    rng=random.Random(943610);extra=[]
    for i in range(2400):
        text=sample(rng,i)
        while normalize(text) in seen:text=sample(rng,i)
        seen.add(normalize(text))
        font=fonts[i%len(fonts)];quality=rng.choice(['clean','clean','blur','small','jpeg','low-contrast','noise']);tracking=rng.choice([0,0,1,2,3,4])
        im=corpus.render({'text':text},font,rng.choice([28,32,36,40]),quality,tracking,943610+i)
        base=folder/f'balanced-{i:05d}';im.save(base.with_suffix('.png'));base.with_suffix('.gt.txt').write_text(text+'\n',encoding='utf8')
        base.with_suffix('.box').write_text('\n'.join(f'{c} 0 0 {im.width} {im.height} 0' for c in text)+'\n'+f'\t 0 0 {im.width} {im.height} 0\n',encoding='utf8')
        extra.append({'file':base.relative_to(OUT).as_posix(),'text':text,'font':font,'quality':quality,'tracking':tracking,'sha256':hashlib.sha256(base.with_suffix('.png').read_bytes()).hexdigest()})
    train=original['splits']['train']+extra
    rng.shuffle(train)
    manifest={**original,'augmentation':'balanced-v2','seedAugmentation':943610,'fontSplits':{**original['fontSplits'],'train':fonts},'splits':{'train':train,'validation':original['splits']['validation']}}
    target=OUT/'corpus-balanced-v2.json';serialized=json.dumps(manifest,ensure_ascii=False,indent=2)+'\n'
    if target.exists() and target.read_text(encoding='utf8')!=serialized:raise RuntimeError('Do not overwrite a different training revision')
    target.write_text(serialized,encoding='utf8')
    print(json.dumps({'trainingLines':len(train),'validationLines':len(manifest['splits']['validation']),'holdoutImagesTrained':0,'trainingFontFiles':len(fonts),'manifest':str(target)},ensure_ascii=True))

if __name__=='__main__':main()
