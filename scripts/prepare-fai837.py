import zipfile,json,base64,pathlib,hashlib
source=pathlib.Path(r'C:/Users/gencg/OneDrive/Desktop/dokumantasyon/6-Formlar_Forms-20260910-085401/6-Formlar (Forms)/F-837-001_Ilk_Parca_Onay_FAI_Formu.xlsx')
out=pathlib.Path('outputs/fai-837/F-837-001_Ilk_Parca_Onay_FAI_Formu.xltx')
with zipfile.ZipFile(source) as z:
    data={n:z.read(n) for n in z.namelist()}
    ct=data['[Content_Types].xml'].replace(b'spreadsheetml.sheet.main+xml',b'spreadsheetml.template.main+xml')
    assert ct!=data['[Content_Types].xml']
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
        for entry in z.infolist():target.writestr(entry,ct if entry.filename=='[Content_Types].xml' else data[entry.filename])
    assets={n:({'text':v.decode('utf-8')} if n.endswith(('.xml','.rels')) else {'base64':base64.b64encode(v).decode()}) for n,v in data.items()}
    pathlib.Path('src/fai837-assets.js').write_text('window.ASMachFai837Assets='+json.dumps(assets,ensure_ascii=True)+';\n',encoding='utf-8')
with zipfile.ZipFile(out) as z:
    assert set(z.namelist())==set(data)
    assert all(z.read(n)==v for n,v in data.items() if n!='[Content_Types].xml')
print('PASS: all workbook parts preserved byte-for-byte except required template content type; '+str(out))
