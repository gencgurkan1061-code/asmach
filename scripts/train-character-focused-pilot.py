"""Isolated character-focused training pilot. Does not overwrite production models.

Labels come from authored rendering geometry, not OCR predictions. Training,
calibration and holdout use separate font families. 100 existing test images
are never used for training. The exported model is advisory only.
"""
import os
os.environ['OPENBLAS_NUM_THREADS'] = '2'
os.environ['OMP_NUM_THREADS'] = '2'
os.environ['MKL_NUM_THREADS'] = '2'
import hashlib, importlib.util, io, json, math, random, time
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs' / 'character-focused-pilot-v1'
FONTS = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
LABELS = list('0123456789') + ['O', 'Ø', 'I', 'l', 'S', 'B', 'R', 'M', 'H', 'C', 'G', 'Z', 'x', '.', ',', '-', '+', '±', '°', '/', '<reject>']
SPLITS = {
    'train': ['arial.ttf', 'arialbd.ttf', 'ariali.ttf', 'times.ttf', 'timesi.ttf', 'cour.ttf', 'courbd.ttf', 'cambria.ttc', 'cambriai.ttf'],
    'calibration': ['calibri.ttf', 'calibrii.ttf', 'Candara.ttf'],
    'holdout': ['consola.ttf', 'verdana.ttf', 'segoeui.ttf', 'tahoma.ttf'],
}
SEEDS = {'train': 4519801, 'calibration': 9138429, 'holdout': 7981543, 'measurements': 3861298}
FONT_CACHE = {}

def load_module(filename, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

old = load_module('train-technical-glyph-model.py', 'glyph_training_helpers')
old.LABELS = LABELS; old.HIDDEN = 96
renderer = load_module('generate-ocr-100-corpus.py', 'measurement_renderer')

def font_for(name, size):
    key = (name, size)
    if key not in FONT_CACHE: FONT_CACHE[key] = ImageFont.truetype(str(FONTS / name), size)
    return FONT_CACHE[key]

def render_crop(label, name, rng):
    size = int(rng.integers(16, 57)); font = font_for(name, size)
    unknown = ['A', 'D', 'E', 'F', 'K', 'N', 'P', 'Q', 'T', 'U', 'V', 'W', 'Y', 'a', 'b', 'd', 'e', 'q', 'r', ':', ';', '=', '#', '%', '?', '00', '11', '18', '56', '88', 'O0', 'I1']
    char = str(rng.choice(unknown)) if label == '<reject>' else label
    if label == '-' and rng.random() < .35: char = '−'
    reference = font.getbbox('0')[3] - font.getbbox('0')[1]
    # Render a short contextual strip and crop the labelled centre region. This
    # preserves typography and baseline size; neighbouring glyphs are not labels.
    left = str(rng.choice(list('012568MR'))); right = str(rng.choice(list('012589H')))
    pieces = [left, char, right]; padding = 12; x = padding; baseline = size + 15
    strip = Image.new('L', (size * 9 + 50, size * 2 + 40), 255); draw = ImageDraw.Draw(strip)
    tracking = float(rng.uniform(0, size * .28)); fill = int(rng.integers(0, 166)); bounds = None
    for i, piece in enumerate(pieces):
        box = draw.textbbox((x, baseline), piece, font=font, anchor='ls')
        draw.text((x, baseline), piece, font=font, anchor='ls', fill=fill)
        if i == 1: bounds = box
        x += font.getlength(piece) + tracking + 3
    l, t, r, b = bounds
    # Tiny crop jitter simulates imprecise segmentation. Severe clipping belongs
    # only to the reject class so missing information is not taught as certain.
    jitter = int(rng.integers(0, 3))
    image = strip.crop((l - jitter - 1, t - 2, r + jitter + 1, b + 2))
    mode = int(rng.integers(0, 6)) if label == '<reject>' else -1
    if mode == 0:
        image = Image.new('L', (size + 14, size + 14), 255); d = ImageDraw.Draw(image)
        d.line((2, image.height - 3, image.width - 3, 2), fill=fill, width=int(rng.integers(1, 4)))
        d.line((image.width - 10, 2, image.width - 3, 2, image.width - 3, 9), fill=fill, width=2)
    elif mode == 1:
        image = Image.new('L', (size + 14, size + 14), 255); ImageDraw.Draw(image).rectangle((2, 2, image.width - 3, image.height - 3), outline=fill, width=2)
    elif mode == 2:
        # A cut fragment of a valid character is explicitly unknown.
        f = font_for(name, size); source = Image.new('L', (size * 2, size * 2), 255)
        ImageDraw.Draw(source).text((6, size + 4), str(rng.choice(list('3689BØ'))), font=f, fill=fill, anchor='ls')
        image = source.crop((0, 0, max(4, int(size * .27)), size * 2))
    if rng.random() < .32: image = image.filter(ImageFilter.MinFilter(3) if rng.random() < .5 else ImageFilter.MaxFilter(3))
    if rng.random() < .7: image = image.filter(ImageFilter.GaussianBlur(float(rng.uniform(.1, .65))))
    image = image.rotate(float(rng.uniform(-4, 4)), resample=Image.Resampling.BILINEAR, expand=True, fillcolor=255)
    scale = float(rng.uniform(.55, 1.15)); image = image.resize((max(3, round(image.width * scale)), max(3, round(image.height * scale))), Image.Resampling.BILINEAR)
    reference *= scale
    if rng.random() < .15:
        buf = io.BytesIO(); image.save(buf, format='JPEG', quality=int(rng.integers(40, 85))); buf.seek(0); image = Image.open(buf).convert('L')
    arr = np.asarray(image, dtype=np.float32); arr = np.clip(arr + rng.normal(0, rng.uniform(0, 2), arr.shape), 0, 255).astype(np.uint8)
    # Unlike the old model, use line-height evidence consistently; 15% without it
    # still teaches explicit abstention when a punctuation crop is ambiguous.
    if rng.random() < .15: reference = 0
    return Image.fromarray(arr), reference

def generate(split, per_label):
    rng = np.random.default_rng(SEEDS[split]); xs, ys, details, fixtures = [], [], [], []
    for name in SPLITS[split]:
        for index, label in enumerate(LABELS):
            for n in range(per_label):
                image, reference = render_crop(label, name, rng)
                vector = old.extract_features(image, reference); xs.append(vector); ys.append(index); details.append({'font': name, 'label': label})
                if split == 'holdout' and n < 2:
                    file = f'{Path(name).stem}-{index:02}-{n}.png'; image.save(OUT / 'glyph-holdout' / file)
                    fixtures.append({'file': file, 'label': label, 'font': name, 'referenceHeight': reference, 'features': vector.astype(float).tolist()})
    return np.asarray(xs, dtype=np.float32), np.asarray(ys, dtype=np.int64), details, fixtures

def new_measurements():
    rng = random.Random(SEEDS['measurements']); cases = []
    frozen = json.loads((ROOT / 'tests/fixtures/ocr-100/manifest.json').read_text(encoding='utf8'))
    frozen_text = {c['text'].replace(' ', '').lower() for c in frozen['cases']}
    for i in range(40):
        p = i % 10; n = rng.randint(105, 8800) / 100; tol = rng.choice([.02, .03, .06, .08, .15])
        fmt = lambda v: format(v, '.12g')
        if p == 0: c = {'family': 'Uzunluk', 'text': f'{fmt(n)} ±{fmt(tol)}', 'expected': {'type': 'Uzunluk', 'nominalValue': n, 'lowerTolerance': -tol, 'upperTolerance': tol}}
        elif p == 1: c = {'family': 'Uzunluk', 'text': fmt(n), 'layout': 'stacked', 'upper': '0', 'lower': '-'+fmt(tol), 'expected': {'type': 'Uzunluk', 'nominalValue': n, 'lowerTolerance': -tol, 'upperTolerance': 0}}
        elif p == 2: c = {'family': 'Çap', 'text': f'Ø{fmt(n)} ±{fmt(tol)}', 'expected': {'type': 'Çap', 'nominalValue': n, 'lowerTolerance': -tol, 'upperTolerance': tol}}
        elif p == 3:
            lower = round(n - .08, 2)
            c = {'family': 'Çap', 'text': fmt(n), 'layout': 'limits', 'prefix': 'Ø', 'lower': fmt(lower), 'expected': {'type': 'Çap', 'nominalValue': round((n+lower)/2, 3), 'lowerLimit': lower, 'upperLimit': n}}
        elif p == 4: c = {'family': 'Yarıçap', 'text': f'R{fmt(n)} ±{fmt(tol)}', 'expected': {'type': 'Yarıçap', 'nominalValue': n, 'lowerTolerance': -tol, 'upperTolerance': tol}}
        elif p == 5:
            angle = [18, 32, 58, 82][i//10]; c = {'family': 'Açı', 'text': f'{angle}° ±0.3°', 'expected': {'type': 'Açı', 'nominalValue': angle, 'lowerTolerance': -.3, 'upperTolerance': .3}}
        elif p == 6:
            n, pitch = [(6, 1), (12, 1.75), (18, 2.5), (22, 2.5)][i//10]
            c = {'family': 'Diş', 'text': f'M{n}x{pitch}-6H', 'expected': {'type': 'Diş', 'nominalValue': n, 'threadPitch': pitch, 'threadClass': '6H'}}
        elif p == 7:
            n = [23, 39, 66, 82][i//10]; c = {'family': 'Geçme', 'text': f'{n} H7', 'expected': {'type': 'Geçme', 'nominalValue': n, 'fitClass': 'H7'}}
        elif p == 8:
            n = [.7, 1.3, 2.2, 3.4][i//10]; c = {'family': 'Pah', 'text': f'{n} x 45°', 'expected': {'type': 'Pah', 'nominalValue': n, 'chamferAngle': 45}}
        else:
            n = [.2, .4, 6.3, 12.5][i//10]; c = {'family': 'Yüzey', 'text': f'Ra {n}', 'expected': {'type': 'Yüzey', 'nominalValue': n, 'specialDesignator': 'Ra'}}
        if c['text'].replace(' ', '').lower() in frozen_text: raise ValueError('Duplicate test text')
        font = SPLITS['holdout'][(i + i//10) % 4]; quality = ['clean', 'blur', 'small', 'tracking', 'jpeg', 'thin', 'low-contrast', 'noise'][i % 8]
        c.update(id=f'n{i+1:03}', fontFile=font, quality=quality, standard='Notation-specific synthetic test', tracking=3 if quality == 'tracking' else 0)
        image = renderer.render(c, font, size=36, quality=quality, tracking=c['tracking'], seed=SEEDS['measurements']+i)
        file = c['id']+'.png'; image.save(OUT / 'new-measurements' / file); c.update(file=file, sha256=hashlib.sha256((OUT/'new-measurements'/file).read_bytes()).hexdigest()); cases.append(c)
    return {'synthetic': True, 'training': False, 'seed': SEEDS['measurements'], 'cases': cases, 'frozen100Sha256': hashlib.sha256((ROOT/'tests/fixtures/ocr-100/manifest.json').read_bytes()).hexdigest()}

def main():
    if (OUT / 'training-report.json').exists(): raise SystemExit('Completed experiment exists; do not overwrite it')
    OUT.mkdir(parents=True, exist_ok=True); (OUT/'glyph-holdout').mkdir(exist_ok=True); (OUT/'new-measurements').mkdir(exist_ok=True)
    for split in SPLITS.values():
        for name in split:
            if not (FONTS/name).is_file(): raise SystemExit('Missing font '+name)
    started = time.perf_counter(); x, y, xd, _ = generate('train', 60); cx, cy, cd, _ = generate('calibration', 40)
    print(json.dumps({'stage':'training', 'trainSamples':len(y), 'calibrationSamples':len(cy), 'classes':len(LABELS)}), flush=True)
    t = time.perf_counter(); params, history = old.train(x, y, 45); training_seconds = time.perf_counter()-t
    threshold = old.choose_thresholds(old.probabilities(cx, params), cy)
    # No selection based on the final holdout. Training/thresholds now frozen.
    hx, hy, hd, fixtures = generate('holdout', 35); hp = old.probabilities(hx, params)
    model = {'schemaVersion':1, 'modelId':'character-focused-pilot-v1', 'advisoryOnly':True,
      'input':{'features':old.INPUTS, 'side':24}, 'architecture':{'kind':'mlp-relu-softmax', 'hidden':old.HIDDEN}, 'labels':LABELS, 'thresholds':threshold,
      'weights':{'w1':np.round(params[0].ravel(),7).astype(float).tolist(), 'b1':np.round(params[1],7).astype(float).tolist(), 'w2':np.round(params[2].ravel(),7).astype(float).tolist(), 'b2':np.round(params[3],7).astype(float).tolist()},
      'training':{'method':'supervised Adam/backpropagation on contextual cropped characters', 'fontSplits':SPLITS, 'splitSeeds':SEEDS, 'samples':len(y), 'epochs':45},
      'limitations':['Synthetic, not real human-confirmed crop training.', 'Whole glyphs and reject fragments only; no automatic value replacement.', 'Softmax scores are not correctness probabilities.']}
    model_bytes = (json.dumps(model, ensure_ascii=False, separators=(',',':'))+'\n').encode('utf8'); (OUT/'model.json').write_bytes(model_bytes)
    old_model = json.loads((ROOT/'ocr/experimental-model/technical-glyph-v1.json').read_text(encoding='utf8')); ow=old_model['weights']; hidden=old_model['architecture']['hidden']
    op=[np.array(ow['w1'],dtype=np.float32).reshape(old.INPUTS,hidden),np.array(ow['b1'],dtype=np.float32),np.array(ow['w2'],dtype=np.float32).reshape(hidden,len(old_model['labels'])),np.array(ow['b2'],dtype=np.float32)]
    shared=np.array([LABELS[int(k)] in old_model['labels'] for k in hy]); old_predictions=old.probabilities(hx[shared],op).argmax(axis=1)
    shared_truth=[LABELS[int(k)] for k in hy[shared]]
    report={'createdAt':datetime.now(timezone.utc).isoformat(), 'synthetic':True, 'realUserCorrections':0, 'productionEnabled':False, 'trainingSeconds':training_seconds,
      'fontSplits':SPLITS, 'splitSeeds':SEEDS, 'modelSha256':hashlib.sha256(model_bytes).hexdigest(), 'modelBytes':len(model_bytes), 'thresholds':threshold,
      'train':old.evaluate(old.probabilities(x,params),y,xd,threshold), 'calibration':old.evaluate(old.probabilities(cx,params),cy,cd,threshold), 'holdout':old.evaluate(hp,hy,hd,threshold),
      'commonLabelComparison':{'samples':int(shared.sum()), 'oldExact':sum(old_model['labels'][int(k)]==truth for k,truth in zip(old_predictions,shared_truth)), 'newExact':int((hp[shared].argmax(axis=1)==hy[shared]).sum())},
      'history':history, 'totalSeconds':time.perf_counter()-started}
    (OUT/'glyph-fixtures.json').write_text(json.dumps({'modelSha256':report['modelSha256'],'fixtures':fixtures},ensure_ascii=False),encoding='utf8')
    (OUT/'new-measurements.json').write_text(json.dumps(new_measurements(),ensure_ascii=False,indent=2),encoding='utf8')
    (OUT/'training-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:report[k] for k in ['modelBytes','trainingSeconds','thresholds','holdout','commonLabelComparison']},ensure_ascii=False),flush=True)

if __name__ == '__main__': main()
