import re
import zipfile
import xml.etree.ElementTree as E

path = r"C:\Users\gencg\OneDrive\Desktop\balonlama test\şablonlar\Parca_Muayene_Formu.xltx"
ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
with zipfile.ZipFile(path) as archive:
    root = E.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    strings = []
    if "xl/sharedStrings.xml" in archive.namelist():
        shared = E.fromstring(archive.read("xl/sharedStrings.xml"))
        strings = ["".join(item.itertext()) for item in shared.findall("m:si", ns)]

    def value(cell):
        kind = cell.attrib.get("t")
        raw = cell.findtext("m:v", default="", namespaces=ns)
        inline = cell.find("m:is", ns)
        if kind == "s" and raw:
            return strings[int(raw)]
        return "".join(inline.itertext()) if inline is not None else raw

    for row in range(39, 48):
        values = []
        node = root.find(f'.//m:row[@r="{row}"]', ns)
        if node is not None:
            for cell in node.findall("m:c", ns):
                shown = value(cell)
                formula = cell.findtext("m:f", default="", namespaces=ns)
                if shown or formula:
                    values.append((cell.attrib.get("r"), shown, formula))
        print(row, values)
    print("MERGES")
    print([item.attrib["ref"] for item in root.findall(".//m:mergeCell", ns) if any(int(number) >= 39 for number in re.findall(r"\d+", item.attrib["ref"]))])
