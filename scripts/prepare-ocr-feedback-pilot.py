"""Isolated, synthetic user-correction simulation. Never changes app data.
200 feedback examples, 40 validation lines and 40 never-trained measurements.
The previous 100-case benchmark remains a separate retention test.
"""
import hashlib, importlib.util, json, random
from pathlib import Path
spec=importlib.util.spec_from_file_location('measure_corpus',Path(__file__).with_name('generate-ocr-100-corpus.py'))
corpus=importlib.util.module_from_spec(spec);spec.loader.exec_module(corpus)
OUT=corpus.OUT;STUDY=OUT/'feedback-study-v1'
FONTS=['calibrib.ttf','framdit.ttf']

def example(rng,index):
    n=round(rng.uniform(3,140),2);t=round(rng.uniform(.01,.25),2);s=f'{n:g}';delta=f'{t:g}'
    group=index%8
    if group==0:return s+' ±'+delta,{'type':'Uzunluk','nominalValue':n,'lowerTolerance':-t,'upperTolerance':t},'ISO 129-1'
    if group==1:return s+' +'+delta+'/0',{'type':'Uzunluk','nominalValue':n,'lowerTolerance':0,'upperTolerance':t},'ISO 129-1'
    if group==2:return 'Ø'+s+' ±'+delta,{'type':'Çap','nominalValue':n,'lowerTolerance':-t,'upperTolerance':t},'ISO 129-1'
    if group==3:return 'R'+s+' ±'+delta,{'type':'Yarıçap','nominalValue':n,'lowerTolerance':-t,'upperTolerance':t},'ISO 129-1'
    if group==4:return s+'° ±'+delta+'°',{'type':'Açı','nominalValue':n,'lowerTolerance':-t,'upperTolerance':t},'ASME Y14.5'
    if group==5:
        major=rng.choice([3,4,5,6,8,10,12,14,16,18,20,22,24,27,30,33,36,42,48,56,64,72]);pitch=rng.choice([.5,.75,1,1.25,1.5,2,2.5,3,4]);cls=rng.choice(['6H','6g'])
        return f'M{major}x{pitch:g}-{cls}',{'type':'Diş','nominalValue':major,'threadPitch':pitch,'threadClass':cls,'unit':'mm'},'ISO 261 / ISO 965-1'
    if group==6:
        fit=rng.choice(['H7','h6','H8','g6']);return s+' '+fit,{'type':'Geçme','nominalValue':n,'fitClass':fit},'ISO 286'
    param=rng.choice(['Ra','Rz','Rq']);return param+' '+s,{'type':'Yüzey','nominalValue':n,'specialDesignator':param},'ISO 21920'

def main():
    if (STUDY/'manifest.json').exists():raise RuntimeError('Existing experiment must not be overwritten')
    original=json.loads((OUT/'corpus-balanced-v2.json').read_text(encoding='utf8'))
    oldtest=corpus.ROOT/'tests/fixtures/ocr-100/manifest.json';old=json.loads(oldtest.read_text(encoding='utf8'))
    norm=lambda s:s.lower().replace(' ','')
    reserved={norm(r['text']) for rows in original['splits'].values() for r in rows}|{norm(r['text']) for r in old['cases']}
    hashes={r['sha256'] for rows in original['splits'].values() for r in rows}|{r['sha256'] for r in old['cases']}
    splits={}
    for name,count,seed in [('feedback',200,920163),('validation',40,720163),('holdout',40,520163)]:
        rng=random.Random(seed);folder=STUDY/name;folder.mkdir(parents=True,exist_ok=True);rows=[]
        for i in range(count):
            text,expected,standard=example(rng,i)
            while norm(text) in reserved:text,expected,standard=example(rng,i)
            reserved.add(norm(text));font=FONTS[(i//8)%2];quality=['clean','blur','small','tracking','low-contrast'][i%5];tracking=2 if quality=='tracking' else 0
            im=corpus.render({'text':text},font,size=34+(i%3)*2,quality=quality,tracking=tracking,seed=seed+i)
            base=folder/f'{name}-{i:03d}';im.save(base.with_suffix('.png'));digest=hashlib.sha256(base.with_suffix('.png').read_bytes()).hexdigest()
            if digest in hashes:raise RuntimeError('Duplicate image')
            hashes.add(digest)
            row={'id':base.name,'file':base.relative_to(OUT).as_posix(),'text':text,'expected':expected,'family':expected['type'],'standard':standard,'font':font,'quality':quality,'sha256':digest,'batch':1 if i<100 else 2,'labelSource':'synthetic-ground-truth','userConfirmed':False,'simulatedConfirmation':name=='feedback','documentGroup':name+'-'+str(i//8)}
            rows.append(row)
            if name!='holdout':
                base.with_suffix('.gt.txt').write_text(text+'\n',encoding='utf8')
                base.with_suffix('.box').write_text('\n'.join(f'{c} 0 0 {im.width} {im.height} 0' for c in text)+'\n'+f'\t 0 0 {im.width} {im.height} 0\n',encoding='utf8')
        splits[name]=rows
    replay=random.Random(410163).sample(original['splits']['train'],800)
    manifest={'schema':1,'purpose':'feedback-learning-pilot','synthetic':True,'realUserCorrections':0,'productionEnabled':False,'labelPolicy':'Only known synthetic labels; no OCR predictions become training labels.','startingModel':'balanced-v2','fonts':FONTS,'splits':splits,'replay':replay,'retentionManifestSha256':hashlib.sha256(oldtest.read_bytes()).hexdigest()}
    (STUDY/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'feedback':200,'validation':40,'unseenTests':40,'replay':800,'retentionTests':100,'productionChanged':False}))

if __name__=='__main__':main()
