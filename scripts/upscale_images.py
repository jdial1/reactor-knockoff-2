#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageSequence
except ImportError:
    sys.exit("Install Pillow: pip install Pillow")

IMAGE_EXTENSIONS = {".gif", ".png", ".jpg", ".jpeg", ".bmp"}
OUTPUT_FORMATS = {"webp", "avif"}
REFERENCE_EXTENSIONS = {".css", ".js", ".html", ".mjs"}
FORMAT_OPTIONS = {
    "webp": {"ext": ".webp", "save": "WEBP", "kwargs": {"lossless": True, "method": 6}},
    "avif": {"ext": ".avif", "save": "AVIF", "kwargs": {"lossless": True}},
}


def collect_images(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def load_frames(path: Path) -> tuple[list[Image.Image], list[int], bool]:
    with Image.open(path) as source:
        is_animated = bool(getattr(source, "n_frames", 1) > 1)
        frames: list[Image.Image] = []
        durations: list[int] = []
        default_duration = source.info.get("duration", 100)

        if is_animated:
            for frame in ImageSequence.Iterator(source):
                rgba = frame.convert("RGBA")
                durations.append(frame.info.get("duration", default_duration))
                frames.append(rgba)
        else:
            rgba = source.convert("RGBA")
            frames.append(rgba)
            durations.append(default_duration)

    return frames, durations, is_animated


def upscale_frame(frame: Image.Image, scale: int) -> Image.Image:
    if scale == 1:
        return frame
    width, height = frame.size
    return frame.resize((width * scale, height * scale), Image.Resampling.NEAREST)


def save_frames(
    frames: list[Image.Image],
    durations: list[int],
    destination: Path,
    fmt: str,
    is_animated: bool,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    options = FORMAT_OPTIONS[fmt]
    save_kwargs = dict(options["kwargs"])

    if is_animated and len(frames) > 1:
        frames[0].save(
            destination,
            options["save"],
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            **save_kwargs,
        )
        return

    frames[0].save(destination, options["save"], **save_kwargs)


def output_path(source: Path, source_root: Path, output_root: Path, fmt: str) -> Path:
    relative = source.relative_to(source_root)
    return (output_root / relative).with_suffix(FORMAT_OPTIONS[fmt]["ext"])


def process_image(source: Path, destination: Path, scale: int, fmt: str) -> dict:
    frames, durations, is_animated = load_frames(source)
    upscaled = [upscale_frame(frame, scale) for frame in frames]
    save_frames(upscaled, durations, destination, fmt, is_animated)

    return {
        "source": str(source.as_posix()),
        "output": str(destination.as_posix()),
        "format": fmt,
        "scale": scale,
        "animated": is_animated,
        "source_size": list(frames[0].size),
        "output_size": list(upscaled[0].size),
    }


def rewrite_references(project_root: Path, manifest: list[dict]) -> int:
    replacements: list[tuple[str, str]] = []
    for entry in manifest:
        source = Path(entry["source"])
        output = Path(entry["output"])
        try:
            source_rel = source.relative_to(project_root).as_posix()
            output_rel = output.relative_to(project_root).as_posix()
        except ValueError:
            continue
        replacements.append((source_rel, output_rel))
        replacements.append((source.name, output.name))

    replacements = sorted(set(replacements), key=lambda pair: len(pair[0]), reverse=True)
    updated_files = 0

    for path in project_root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in REFERENCE_EXTENSIONS:
            continue
        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in replacements:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            updated_files += 1

    return updated_files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upscale game images and convert them to WebP or AVIF."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("img"),
        help="Directory containing source images (default: img)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output directory (default: same as --source)",
    )
    parser.add_argument(
        "--scale",
        type=int,
        default=2,
        help="Upscale factor (default: 2)",
    )
    parser.add_argument(
        "--format",
        choices=sorted(FORMAT_OPTIONS),
        default="webp",
        help="Output format (default: webp)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List planned conversions without writing files",
    )
    parser.add_argument(
        "--remove-sources",
        action="store_true",
        help="Delete source files after successful conversion",
    )
    parser.add_argument(
        "--rewrite-references",
        action="store_true",
        help="Replace old image paths in css/js/html/mjs files",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("scripts/image-upscale-manifest.json"),
        help="Manifest output path",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_root = args.source.resolve()
    output_root = (args.output or args.source).resolve()
    project_root = Path.cwd().resolve()

    if not source_root.is_dir():
        print(f"Source directory not found: {source_root}", file=sys.stderr)
        return 1

    if args.scale < 1:
        print("--scale must be at least 1", file=sys.stderr)
        return 1

    images = collect_images(source_root)
    if not images:
        print(f"No images found under {source_root}")
        return 0

    manifest: list[dict] = []
    converted = 0
    skipped = 0

    for source in images:
        destination = output_path(source, source_root, output_root, args.format)
        if destination.resolve() == source.resolve():
            skipped += 1
            continue

        entry = {
            "source": str(source.as_posix()),
            "output": str(destination.as_posix()),
            "format": args.format,
            "scale": args.scale,
            "animated": False,
            "source_size": None,
            "output_size": None,
        }

        if args.dry_run:
            with Image.open(source) as preview:
                width, height = preview.size
            entry["source_size"] = [width, height]
            entry["output_size"] = [width * args.scale, height * args.scale]
            manifest.append(entry)
            print(f"{source.name} -> {destination.name} ({width}x{height} -> {entry['output_size'][0]}x{entry['output_size'][1]})")
            continue

        try:
            entry = process_image(source, destination, args.scale, args.format)
            manifest.append(entry)
            converted += 1
            print(f"Converted {source.name} -> {destination.name}")

            if args.remove_sources:
                source.unlink()
        except Exception as error:
            print(f"Failed {source}: {error}", file=sys.stderr)
            return 1

    if not args.dry_run and manifest:
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"Wrote manifest: {args.manifest}")

    if args.rewrite_references and manifest and not args.dry_run:
        updated = rewrite_references(project_root, manifest)
        print(f"Updated references in {updated} files")

    print(
        f"Done. processed={len(images)} converted={converted} skipped={skipped} dry_run={args.dry_run}"
    )
    if args.scale > 1:
        print(
            "Note: CSS background-position and --space-tile values may need manual 2x updates for sprite sheets."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
