#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import fitz


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--min-text-chars", type=int, default=80)
    parser.add_argument("--zoom", type=float, default=2.4)
    args = parser.parse_args()

    input_path = Path(args.input)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(input_path))
    pages = []
    matrix = fitz.Matrix(args.zoom, args.zoom)

    for index in range(doc.page_count):
        page = doc.load_page(index)
        text = (page.get_text("text") or "").strip()
        image_path = ""

        if len(text) < args.min_text_chars:
            pix = page.get_pixmap(matrix=matrix, alpha=False, colorspace=fitz.csGRAY)
            image_path = str(out_dir / f"page-{index + 1:04d}.png")
            pix.save(image_path)

        pages.append({
            "page": index + 1,
            "text": text,
            "textLength": len(text),
            "imagePath": image_path,
        })

    print(json.dumps({
        "pages": pages,
        "pageCount": doc.page_count,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
