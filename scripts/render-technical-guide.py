"""Render the repository's technical Markdown guide to a readable PDF."""
from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "CHAMPIONS_CLUB_TECHNICAL_GUIDE.md"
TARGET = ROOT / "docs" / "CHAMPIONS_CLUB_TECHNICAL_GUIDE.pdf"
font_root = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("Arial", str(font_root / "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(font_root / "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("Consolas", str(font_root / "consola.ttf")))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold")

orange = colors.HexColor("#D75A12")
slate = colors.HexColor("#233044")
soft = colors.HexColor("#F0F3F6")
styles = {
    "title": ParagraphStyle("title", fontName="Arial-Bold", fontSize=22, leading=27, textColor=slate, spaceAfter=16),
    "h2": ParagraphStyle("h2", fontName="Arial-Bold", fontSize=14, leading=18, textColor=orange, spaceBefore=17, spaceAfter=8, keepWithNext=True),
    "h3": ParagraphStyle("h3", fontName="Arial-Bold", fontSize=10.5, leading=14, textColor=slate, spaceBefore=11, spaceAfter=5, keepWithNext=True),
    "body": ParagraphStyle("body", fontName="Arial", fontSize=9.2, leading=14.2, textColor=slate, spaceAfter=8),
    "small": ParagraphStyle("small", fontName="Arial", fontSize=7.8, leading=11.2, textColor=slate),
    "headcell": ParagraphStyle("headcell", fontName="Arial-Bold", fontSize=8, leading=10.5, textColor=colors.white),
    "code": ParagraphStyle("code", fontName="Consolas", fontSize=7, leading=9.3, textColor=slate),
}

def inline(s):
    s = escape(s)
    s = re.sub(r"`([^`]+)`", r'<font name="Consolas" size="8">\1</font>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    return s

def footer(canvas, doc):
    canvas.saveState()
    w, _ = A4
    canvas.setStrokeColor(colors.HexColor("#D8DEE5"))
    canvas.line(42, 39, w - 42, 39)
    canvas.setFont("Arial", 7)
    canvas.setFillColor(slate)
    canvas.drawString(42, 27, "CHAMPIONS CLUB  |  TECHNICAL GUIDE  |  3 OCT 2026")
    canvas.drawRightString(w - 42, 27, str(doc.page))
    canvas.restoreState()

lines = SOURCE.read_text(encoding="utf-8").splitlines()
story = []
i = 0
while i < len(lines):
    line = lines[i].strip()
    if not line:
        i += 1
        continue
    if line.startswith("# "):
        story.append(Paragraph(inline(line[2:]), styles["title"]))
        i += 1
        continue
    if line.startswith("## "):
        story.append(Paragraph(inline(line[3:]), styles["h2"]))
        i += 1
        continue
    if line.startswith("### "):
        story.append(Paragraph(inline(line[4:]), styles["h3"]))
        i += 1
        continue
    if line.startswith("```"):
        code = []
        i += 1
        while i < len(lines) and not lines[i].startswith("```"):
            code.append(lines[i].expandtabs(2))
            i += 1
        # Wrap exceptional long lines without changing the source document.
        wrapped = []
        for row in code:
            while len(row) > 104:
                wrapped.append(row[:104])
                row = "    " + row[104:]
            wrapped.append(row)
        block = Preformatted("\n".join(wrapped), styles["code"], maxLineLength=108)
        story.append(Table([[block]], colWidths=[A4[0]-86], style=TableStyle([
            ("BACKGROUND", (0,0),(-1,-1), soft), ("BOX",(0,0),(-1,-1),0.3,colors.HexColor("#CDD5DE")),
            ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
            ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8)
        ])))
        story.append(Spacer(1, 9))
        i += 1
        continue
    if line.startswith("|"):
        rows=[]
        while i < len(lines) and lines[i].strip().startswith("|"):
            cells=[x.strip() for x in lines[i].strip().strip("|").split("|")]
            if not all(re.fullmatch(r"[-: ]+", x) for x in cells):
                rows.append(cells)
            i += 1
        width = A4[0]-86
        count=max(len(r) for r in rows)
        col_widths=([width*.22,width*.24,width*.54] if count==3 else [width/count]*count)
        data=[]
        for n,row in enumerate(rows):
            sty=styles["headcell"] if n==0 else styles["small"]
            data.append([Paragraph(inline(x),sty) for x in row])
        table=Table(data,colWidths=col_widths,repeatRows=1,hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0),slate),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,soft]),
            ("VALIGN",(0,0),(-1,-1),"TOP"),("LINEBELOW",(0,-1),(-1,-1),.4,colors.HexColor("#CBD5E1")),
            ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5)
        ]))
        story.append(table)
        story.append(Spacer(1, 8))
        continue
    para=[line]
    i += 1
    while i<len(lines) and lines[i].strip() and not lines[i].startswith(("#", "```", "|")):
        para.append(lines[i].strip())
        i += 1
    story.append(Paragraph(inline(" ".join(para)), styles["body"]))

doc=SimpleDocTemplate(str(TARGET),pagesize=A4,rightMargin=43,leftMargin=43,topMargin=48,bottomMargin=53,
                      title="Champions Club — Complete Technical Guide",author="Champions Club project")
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(TARGET)
