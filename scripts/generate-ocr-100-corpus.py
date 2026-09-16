"""Disjoint synthetic training/validation and locked 100-measurement OCR test.
Font files stay local. Labels are authored, never derived from the OCR/parser.
The 100 test images are NEVER passed to Tesseract training/checkpoint selection.
"""
import argparse, hashlib, io, json, math, os, random
from collections import Counter
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'/'tesseract-finetune'
FONTS=Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'
TRAIN_FONTS=['arial.ttf','ariali.ttf','times.ttf','timesi.ttf','cour.ttf','calibri.ttf']
VALID_FONTS=['cambria.ttc','calibrii.ttf']
TEST_FONTS=['consola.ttf','verdana.ttf','segoeui.ttf','tahoma.ttf']
CASES=[]
def add(family,text,expected,standard='ISO 129-1',**extra):
    CASES.append(dict(id=f'm{len(CASES)+1:03d}',family=family,text=text,expected=expected,standard=standard,**extra))
def dim(family,text,n,lo=None,hi=None,**extra):
    expected={'type':family,'nominalValue':n}
    if lo is not None: expected['lowerTolerance']=lo
    if hi is not None: expected['upperTolerance']=hi
    add(family,text,expected,**extra)

# 14 length dimensions: explicit deviations, limit dimensions and title-block context.
dim('Uzunluk','18.375',18.375)
dim('Uzunluk','72,65',72.65)
dim('Uzunluk','43.7 ±0.15',43.7,-.15,.15)
dim('Uzunluk','28.4 +0.3/-0.1',28.4,-.1,.3)
dim('Uzunluk','36 +0.2/0',36,0,.2)
dim('Uzunluk','19 0/-0.05',19,-.05,0)
dim('Uzunluk','22 (+0.3/+0.1)',22,.1,.3)
dim('Uzunluk','14 (-0.2/-0.1)',14,-.2,-.1)
dim('Uzunluk','47.5',47.5,-.08,.12,layout='stacked',upper='+0.12',lower='-0.08')
dim('Uzunluk','62',62,0,.25,layout='stacked',upper='+0.25',lower='0')
add('Uzunluk','0.739',{'type':'Uzunluk','nominalValue':.734,'lowerLimit':.729,'upperLimit':.739},'ASME Y14.5',layout='limits',lower='0.729')
add('Uzunluk','8.35 MAX 8.15 MIN',{'type':'Uzunluk','nominalValue':8.25,'lowerLimit':8.15,'upperLimit':8.35},'ASME Y14.5')
add('Uzunluk','0.625 in',{'type':'Uzunluk','nominalValue':.625,'unit':'in'},'ASME Y14.5')
add('Uzunluk','25',{'type':'Uzunluk','nominalValue':25,'lowerTolerance':-.2,'upperTolerance':.2},'ISO 2768-mK',generalTolerance='ISO 2768-mK')
# 10 diameters.
dim('Çap','Ø17.35',17.35)
dim('Çap','Ø42.8 ±0.03',42.8,-.03,.03)
dim('Çap','Ø 31,75 ±0,04',31.75,-.04,.04)
dim('Çap','Ø51.6',51.6,-.06,0,layout='stacked',upper='0',lower='-0.06')
dim('Çap','Ø8.4',8.4,-.02,.04,layout='stacked',upper='+0.04',lower='-0.02')
add('Çap','0.367',{'type':'Çap','nominalValue':.363,'lowerLimit':.359,'upperLimit':.367},'ASME Y14.5',layout='limits',prefix='Ø',lower='0.359')
add('Çap','4x Ø7.5 ±0.05',{'type':'Çap','nominalValue':7.5,'quantity':4,'lowerTolerance':-.05,'upperTolerance':.05})
add('Çap','Ø11.8 THRU',{'type':'Çap','nominalValue':11.8,'callout.through':True},'ASME Y14.5')
add('Çap','Ø9 x 16 DEEP',{'type':'Çap','nominalValue':9,'callout.depth':'16'},'ASME Y14.5')
dim('Çap','Ø64.3 +0.04/0',64.3,0,.04)
# 6 radii and 6 angles.
for text,n,lo,hi in [('R7.25',7.25,None,None),('R16 ±0.2',16,-.2,.2),('R3,8',3.8,None,None),('R48.5 +0.3/0',48.5,0,.3),('R2.75 0/-0.05',2.75,-.05,0),('R125 ±0.5',125,-.5,.5)]:dim('Yarıçap',text,n,lo,hi)
for text,n,lo,hi in [('37°',37,None,None),('60° ±0.5°',60,-.5,.5),('22.5° ±0.2°',22.5,-.2,.2),('15° 30′',15.5,None,None),('75° ±30′',75,-.5,.5),('120° +1°/-0.5°',120,-.5,1)]:dim('Açı',text,n,lo,hi)
# 18 threads spanning metric, unified, NPT and BSP families.
for text,n,pitch,cls,standard,unit in [
 ('M5',5,'','','ISO 261','mm'),('M10x1.25-6H',10,1.25,'6H','ISO 261 / ISO 965-1','mm'),
 ('M16x2-6g',16,2,'6g','ISO 261 / ISO 965-1','mm'),('M24x1.5-6H',24,1.5,'6H','ISO 261 / ISO 965-1','mm'),
 ('M8 × 1,0-6H',8,1,'6H','ISO 261 / ISO 965-1','mm'),('M20x2.5-6g',20,2.5,'6g','ISO 261 / ISO 965-1','mm'),
 ('3/8-16 UNC-2B',.375,'16 TPI','2B','ASME B1.1','in'),('1/2-20 UNF-2A',.5,'20 TPI','2A','ASME B1.1','in'),
 ('#10-32 UNF-2B',.19,'32 TPI','2B','ASME B1.1','in'),('1/4-20 UNC-2A',.25,'20 TPI','2A','ASME B1.1','in'),
 ('1/8-27 NPT',.125,'27 TPI','NPT','ASME B1.20.1','in'),('3/8-18 NPT',.375,'18 TPI','NPT','ASME B1.20.1','in'),
 ('1/4-18 NPTF',.25,'18 TPI','NPTF','ASME B1.20.3','in'),('1/2-14 NPSM',.5,'14 TPI','NPSM','ASME B1.20.1','in'),
 ('G 1/2 A',.5,'14 TPI','A','ISO 228-1','in'),('Rc 1/4',.25,'19 TPI','','ISO 7-1','in'),
 ('Rp 3/8',.375,'19 TPI','','ISO 7-1','in'),('Tr24x5',24,5,'','ISO 2902','mm')]:
    add('Diş',text,{'type':'Diş','nominalValue':n,'threadPitch':pitch,'threadClass':cls,'threadStandard':standard,'unit':unit},standard)
for text,n,fit in [('18 H7',18,'H7'),('35 h6',35,'h6'),('50 JS7',50,'JS7'),('22 g6',22,'g6'),('16 H8',16,'H8'),('40 H7/g6',40,'H7/g6')]:add('Geçme',text,{'type':'Geçme','nominalValue':n,'fitClass':fit},'ISO 286')
for text,n,angle in [('C0.8',.8,''),('1.5 x 45°',1.5,45),('2.5 x 30°',2.5,30),('0.6 × 60°',.6,60),('3 x 45°',3,45),('PAH 1.2',1.2,'')]:add('Pah',text,{'type':'Pah','nominalValue':n,'chamferAngle':angle})
for text,n,param in [('Ra 0.8',.8,'Ra'),('Rz 12.5',12.5,'Rz'),('Rq 2.5',2.5,'Rq'),('Rt 20',20,'Rt'),('Rmax 6.3',6.3,'Rmax'),('Ra 3,2',3.2,'Ra'),('Ra 1.6 MAX',1.6,'Ra'),('Ra 63 µin',63,'Ra')]:add('Yüzey',text,{'type':'Yüzey','nominalValue':n,'specialDesignator':param},'ASME B46.1' if 'µin' in text else 'ISO 21920')
# 12 independently drawn feature-control frames, rather than recognizer templates.
for subtype,value,datums,diam,mmc in [('position',.008,['A'],True,True),('position',.05,['A','B','C'],True,False),('flatness',.12,[],False,False),('straightness',.06,[],False,False),('perpendicularity',.04,['A'],False,False),('parallelism',.07,['B'],False,False),('circularity',.03,[],False,False),('concentricity',.1,['A'],False,False),('angularity',.15,['B'],False,False),('profile',.2,['A'],False,False),('profile_surface',.3,['A','B'],False,False),('runout',.09,['C'],False,False)]:
    add('GD&T',str(value),{'type':'GD&T','gdtSubtype':subtype,'upperTolerance':value,'datumRefs':' | '.join(datums)},'ASME Y14.5' if subtype=='position' else 'ISO 1101',layout='gdt',subtype=subtype,datums=datums,diameter=diam,mmc=mmc)
for ref in ['A','D']:add('Datum','DATUM '+ref,{'type':'Datum','datumRefs':ref},'ISO 5459')
for text,n in [('±0.12',.12),('±0.007',.007)]:add('Tolerans',text,{'lowerTolerance':-n,'upperTolerance':n},'Drawing-specific',typeContext='Tolerans')
for family,items in [('Not',['DEBURR ALL EDGES','NOTE: BREAK SHARP EDGES']),('Malzeme',['MATERIAL: 42CrMo4','MALZEME: AL 6082']),('Proses',['HEAT TREAT 56 HRC','COATING: ZINC 8 µm']),('Görsel',['NO VISIBLE CRACKS','SURFACE FREE OF SCRATCHES']),('Diğer',['INSPECTION PER PLAN Q17','MARK PART NUMBER'])]:
    for text in items:add(family,text,{'type':family} if family not in ['Görsel','Diğer'] else {},'Drawing-specific',textMode=True,**({'typeContext':family} if family in ['Görsel','Diğer'] else {}))
assert len(CASES)==100,len(CASES)

def line(draw,text,x,y,font,tracking=0,fill=15):
    for c in text:
        draw.text((x,y),c,font=font,fill=fill,anchor='ls');x+=font.getlength(c)+tracking
    return x

def symbol(draw,kind,cx,cy,r):
    w=2
    if kind in ['position','circularity','concentricity']:
        draw.ellipse((cx-r,cy-r,cx+r,cy+r),outline=0,width=w)
        if kind=='concentricity':draw.ellipse((cx-r*.58,cy-r*.58,cx+r*.58,cy+r*.58),outline=0,width=w)
        if kind=='position':draw.line((cx-r*1.4,cy,cx+r*1.4,cy),fill=0,width=w);draw.line((cx,cy-r*1.4,cx,cy+r*1.4),fill=0,width=w)
    elif kind=='flatness':draw.line([(cx-r,cy+r*.6),(cx-r*.4,cy-r*.6),(cx+r,cy-r*.6),(cx+r*.4,cy+r*.6),(cx-r,cy+r*.6)],fill=0,width=w)
    elif kind=='straightness':draw.line((cx-r,cy,cx+r,cy),fill=0,width=w)
    elif kind=='perpendicularity':draw.line((cx-r,cy+r*.6,cx+r,cy+r*.6),fill=0,width=w);draw.line((cx,cy-r,cx,cy+r*.6),fill=0,width=w)
    elif kind=='parallelism':
        for dx in [-r*.4,r*.4]:draw.line((cx+dx-r*.35,cy+r,cx+dx+r*.35,cy-r),fill=0,width=w)
    elif kind=='angularity':draw.line([(cx+r,cy+r*.6),(cx-r,cy+r*.6),(cx+r*.4,cy-r)],fill=0,width=w)
    elif kind in ['profile','profile_surface']:
        draw.arc((cx-r,cy-r,cx+r,cy+r),180,360,fill=0,width=w)
        if kind=='profile_surface':draw.line((cx-r,cy,cx+r,cy),fill=0,width=w)
    elif kind=='runout':draw.line((cx-r,cy+r,cx+r,cy-r),fill=0,width=w);draw.line([(cx+r*.25,cy-r),(cx+r,cy-r),(cx+r,cy-r*.25)],fill=0,width=w)

def render(case,fontname,size=36,quality='clean',tracking=0,seed=0):
    font=ImageFont.truetype(str(FONTS/fontname),size);small=ImageFont.truetype(str(FONTS/fontname),round(size*.64))
    im=Image.new('L',(1700,150 if case.get('layout') in ['stacked','limits'] else 92),255);d=ImageDraw.Draw(im)
    fill=140 if quality=='low-contrast' else 15
    if case.get('layout')=='gdt':
        im=Image.new('L',(1100,86),255);d=ImageDraw.Draw(im);left=14;top=12;bottom=73;first=84
        symbol(d,case['subtype'],49,42,15)
        text=('Ø' if case.get('diameter') else '')+case['text'];end=line(d,text,first+10,55,font,0,fill)
        if case.get('mmc'):
            cx=end+22;d.ellipse((cx-17,25,cx+17,59),outline=0,width=2);line(d,'M',cx-11,51,small,0,fill);end=cx+21
        end+=10;cuts=[first,end]
        for datum in case['datums']:end=line(d,datum,end+13,55,font,0,fill)+14;cuts.append(end)
        d.rectangle((left,top,end,bottom),outline=0,width=2)
        for x in cuts[:-1]:d.line((x,top,x,bottom),fill=0,width=2)
    elif case.get('layout')=='stacked':
        end=line(d,case['text'],18,87,font,tracking,fill)+14
        end=max(line(d,case['upper'],end,50,small,tracking,fill),line(d,case['lower'],end,123,small,tracking,fill))
    elif case.get('layout')=='limits':
        x=18
        if case.get('prefix'):x=line(d,case['prefix'],x,92,font,tracking,fill)+8
        end=max(line(d,case['text'],x,56,font,tracking,fill),line(d,case['lower'],x,126,font,tracking,fill))
    else:end=line(d,case['text'],18,64,font,tracking,fill)
    im=im.crop((0,0,min(1700,math.ceil(end+20)),im.height))
    if quality=='blur':im=im.filter(ImageFilter.GaussianBlur(.65))
    elif quality=='small':im=im.resize((round(im.width*.58),round(im.height*.58)),Image.Resampling.LANCZOS)
    elif quality=='jpeg':
        b=io.BytesIO();im.save(b,format='JPEG',quality=45);b.seek(0);im=Image.open(b).copy()
    elif quality=='thin':im=im.filter(ImageFilter.MaxFilter(3))
    elif quality=='noise':
        rng=random.Random(seed);d=ImageDraw.Draw(im)
        for _ in range(max(1,im.width//15)):
            x,y=rng.randrange(im.width),rng.randrange(im.height);d.point((x,y),fill=rng.randint(120,215))
    if case.get('rotation'):im=im.rotate(case['rotation'],expand=True,fillcolor=255)
    return im

def training_text(rng,i):
    n=round(rng.uniform(1,155),rng.choice([0,1,2,3]));s=f'{n:g}';t=rng.choice(['0.01','0.02','0.05','0.1','0.15','0.25'])
    return rng.choice([s,'Ø'+s,'R'+s,'Ø'+s+' ±'+t,s+' +'+t+'/0',s+' 0/-'+t,s+' ±'+t,s+' +0.2/-0.1',s+'° ±0.5°','Ra '+t,'Rz '+s,'Rq '+s,'Rt '+s,'M'+str(rng.choice([4,6,8,10,12,16,20,24,30]))+'x'+rng.choice(['0.5','0.75','1','1.25','1.5','2'])+'-'+rng.choice(['6H','6g']),rng.choice(['1/16','1/8','1/4','3/8','1/2'])+'-'+rng.choice(['14','18','20','27','28','32'])+' '+rng.choice(['UNC-2B','UNF-2A','NPT','NPTF','NPSM']),rng.choice(['G ','Rc ','Rp '])+rng.choice(['1/8','1/4','1/2','3/4']),s+' '+rng.choice(['H7','h6','g6','JS7']),s+' x 45°',s+' MAX',s+' MIN',rng.choice(['A B C','THRU','DEEP','DEPTH','DATUM E','NOTE: REMOVE BURRS','MATERIAL: STEEL','HEAT TREAT','COATING','Rmax '+s]),s+' µm',s+' µin',s+' in'])

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--training-lines',type=int,default=2400);args=ap.parse_args()
    for f in set(TRAIN_FONTS+VALID_FONTS+TEST_FONTS):
        if not (FONTS/f).exists():raise RuntimeError('Missing local font '+f)
    testdir=OUT/'holdout-100';testdir.mkdir(parents=True,exist_ok=True);cases=[]
    qualities=['clean','blur','small','tracking','low-contrast','jpeg','noise','clean']
    for i,entry in enumerate(CASES):
        c={**entry,'fontFile':TEST_FONTS[i%len(TEST_FONTS)],'quality':qualities[i%len(qualities)],'tracking':3 if i%8==3 else 0}
        if i in [2,29,34]:c['rotation']=90 if i!=29 else 270
        im=render(c,c['fontFile'],quality=c['quality'],tracking=c['tracking'],seed=62026+i);filename=c['id']+'.png'
        encoded=io.BytesIO();im.save(encoded,format='PNG');payload=encoded.getvalue();target=testdir/filename
        if target.exists() and target.read_bytes()!=payload:raise RuntimeError('Locked holdout image changed; keep the existing revision: '+filename)
        if not target.exists():target.write_bytes(payload)
        c.update(file=filename,width=im.width,height=im.height,sha256=hashlib.sha256((testdir/filename).read_bytes()).hexdigest());cases.append(c)
    manifest={'schema':1,'purpose':'locked-holdout','training':False,'caseCount':100,'labelSource':'Authored drawing transcriptions and expected fields; not OCR-generated.','synthetic':True,'families':dict(Counter(c['family'] for c in cases)),'fontFamilies':TEST_FONTS,'cases':cases}
    serialized=json.dumps(manifest,ensure_ascii=False,indent=2)+'\n';mp=testdir/'manifest.json'
    if mp.exists() and mp.read_text(encoding='utf8')!=serialized:raise RuntimeError('Locked holdout manifest changed; create a new version instead')
    mp.write_text(serialized,encoding='utf8')
    reserved={c['text'].replace(' ','').lower() for c in cases};splits={}
    for split,count,fonts,seed in [('train',args.training_lines,TRAIN_FONTS,836241),('validation',200,VALID_FONTS,710921)]:
        folder=OUT/'corpus'/split;folder.mkdir(parents=True,exist_ok=True);rng=random.Random(seed);rows=[]
        for i in range(count):
            text=training_text(rng,i)
            while text.replace(' ','').lower() in reserved:text=training_text(rng,i)
            reserved.add(text.replace(' ','').lower());font=rng.choice(fonts);quality=rng.choice(['clean','clean','blur','small','jpeg','low-contrast']);tracking=rng.choice([0,0,1,2,3])
            im=render({'text':text},font,rng.choice([30,34,38,42]),quality,tracking,seed+i);base=folder/f'{split}-{i:05d}'
            im.save(base.with_suffix('.png'));base.with_suffix('.gt.txt').write_text(text+'\n',encoding='utf8')
            # Equivalent line-level box contract to official tesstrain generate_line_box.py.
            box='\n'.join(f'{c} 0 0 {im.width} {im.height} 0' for c in text)+'\n'+f'\t 0 0 {im.width} {im.height} 0\n'
            base.with_suffix('.box').write_text(box,encoding='utf8');rows.append({'file':str(base.relative_to(OUT)).replace('\\','/'),'text':text,'font':font,'quality':quality,'tracking':tracking,'sha256':hashlib.sha256(base.with_suffix('.png').read_bytes()).hexdigest()})
        splits[split]=rows
    data={'schema':1,'purpose':'training-and-validation-only','holdoutManifestSha256':hashlib.sha256(mp.read_bytes()).hexdigest(),'seedTrain':836241,'seedValidation':710921,'fontSplits':{'train':TRAIN_FONTS,'validation':VALID_FONTS,'holdout':TEST_FONTS},'splits':splits}
    (OUT/'corpus-manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (OUT/'all-gt.txt').write_text('\n'.join(r['text'] for r in splits['train'])+'\n',encoding='utf8')
    print(json.dumps({'holdout':len(cases),'families':manifest['families'],'train':len(splits['train']),'validation':len(splits['validation']),'holdoutHash':data['holdoutManifestSha256']},ensure_ascii=False))

if __name__=='__main__':main()
