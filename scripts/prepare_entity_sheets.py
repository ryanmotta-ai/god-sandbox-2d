from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "assets" / "entities"
CELL = 48
FRAMES = 4
DIRECTIONS = ("down", "up", "left", "right")
ANIMATIONS = ("idle", "walk", "work", "attack")


@dataclass(frozen=True)
class Profile:
    source: str
    row: int
    col: int
    category: str
    name: str
    height: int
    kind: str


DEMOGRAPHICS = (
    ("adult_light_v01", 0, 0, 40), ("adult_tan_v01", 0, 1, 40),
    ("adult_brown_v01", 0, 2, 40), ("adult_dark_v01", 0, 3, 40),
    ("infant_v01", 1, 0, 18), ("child_v01", 1, 1, 27),
    ("adolescent_v01", 1, 2, 34), ("elder_v01", 1, 3, 39),
    ("mother_baby_dark_v01", 2, 0, 41), ("mother_baby_light_v01", 2, 1, 41),
    ("father_toddler_v01", 2, 2, 41), ("pregnant_v01", 2, 3, 40),
    ("adult_light_v02", 3, 0, 40), ("adult_tan_v02", 3, 1, 40),
    ("adult_brown_v02", 3, 2, 40), ("adult_dark_v02", 3, 3, 40),
)

PROFESSIONS = (
    ("farmer_v01", 0, 0), ("woodcutter_v01", 0, 1), ("miner_v01", 0, 2), ("builder_v01", 0, 3),
    ("soldier_v01", 1, 0), ("archer_v01", 1, 1), ("scout_v01", 1, 2), ("healer_v01", 1, 3),
    ("leader_v01", 2, 0), ("king_v01", 2, 1), ("crafter_v01", 2, 2), ("merchant_v01", 2, 3),
    ("sailor_v01", 3, 0), ("rail_worker_v01", 3, 1), ("factory_worker_v01", 3, 2), ("scholar_v01", 3, 3),
)

ANIMALS = (
    ("deer_adult_v01", 0, 0, 38), ("wolf_adult_v01", 0, 1, 35),
    ("bear_adult_v01", 0, 2, 42), ("dragon_adult_v01", 0, 3, 43),
    ("boar_adult_v01", 1, 0, 34), ("eagle_adult_v01", 1, 1, 36),
    ("mammoth_adult_v01", 1, 2, 44), ("deer_adult_v02", 1, 3, 38),
    ("deer_young_v01", 2, 0, 27), ("wolf_young_v01", 2, 1, 25),
    ("bear_young_v01", 2, 2, 26), ("dragon_young_v01", 2, 3, 27),
    ("boar_young_v01", 3, 0, 24), ("eagle_young_v01", 3, 1, 24),
    ("mammoth_young_v01", 3, 2, 29), ("deer_young_v02", 3, 3, 27),
)


def profiles() -> list[Profile]:
    result = [Profile("human_demographics_v01.png", r, c, "humans", name, height, "human") for name, r, c, height in DEMOGRAPHICS]
    result += [Profile("human_professions_v01.png", r, c, "professions", name, 42, "human") for name, r, c in PROFESSIONS]
    result += [Profile("animals_v01.png", r, c, "animals", name, height, "animal") for name, r, c, height in ANIMALS]
    return result


def crop_cell(sheet: Image.Image, row: int, col: int) -> Image.Image:
    left = round(col * sheet.width / 4)
    right = round((col + 1) * sheet.width / 4)
    top = round(row * sheet.height / 4)
    bottom = round((row + 1) * sheet.height / 4)
    cell = sheet.crop((left, top, right, bottom)).convert("RGBA")
    alpha = cell.getchannel("A")
    box = alpha.point(lambda value: 255 if value > 12 else 0).getbbox()
    if not box:
        raise RuntimeError(f"empty cell {row},{col}")
    return cell.crop(box)


def normalize(sprite: Image.Image, target_height: int) -> Image.Image:
    width = max(1, round(sprite.width * target_height / sprite.height))
    if width > 45:
        target_height = max(1, round(target_height * 45 / width))
        width = 45
    sprite = sprite.resize((width, target_height), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.alpha_composite(sprite, ((CELL - width) // 2, CELL - target_height - 2))
    return canvas


def anchored_rotate(sprite: Image.Image, angle: float) -> Image.Image:
    rotated = sprite.rotate(angle, resample=Image.Resampling.NEAREST, expand=False, center=(CELL // 2, CELL - 3))
    return rotated


def offset(sprite: Image.Image, dx: int, dy: int) -> Image.Image:
    canvas = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    canvas.alpha_composite(sprite, (dx, dy))
    return canvas


def walk_frame(base: Image.Image, frame: int, animal: bool) -> Image.Image:
    bob = (0, -1, 0, -1)[frame]
    result = offset(base, 0, bob)
    alpha_box = base.getchannel("A").getbbox()
    if not alpha_box or frame in (1, 3):
        return result
    top = alpha_box[1] + round((alpha_box[3] - alpha_box[1]) * (0.64 if animal else 0.72))
    center = (alpha_box[0] + alpha_box[2]) // 2
    left = base.crop((0, top, center, CELL))
    right = base.crop((center, top, CELL, CELL))
    # Repaint the lower limbs with opposing stride. The edit stays pixel-hard.
    stride = 2 if frame == 0 else -2
    mask = Image.new("RGBA", (CELL, CELL - top), (0, 0, 0, 0))
    mask.alpha_composite(left, (stride, 0))
    mask.alpha_composite(right, (-stride, 0))
    result.paste((0, 0, 0, 0), (0, top, CELL, CELL))
    result.alpha_composite(mask, (0, top + bob))
    return result


def action_frame(base: Image.Image, animation: str, frame: int, animal: bool) -> Image.Image:
    if animation == "idle":
        return offset(base, 0, (0, -1, 0, 0)[frame])
    if animation == "walk":
        return walk_frame(base, frame, animal)
    if animation == "work":
        angles = (0, 4, 8, 3) if animal else (-3, 1, 6, 1)
        worked = anchored_rotate(base, angles[frame])
        return offset(worked, 0, (0, 1, 2, 1)[frame] if animal else (0, -1, 1, 0)[frame])
    # Attack is a readable anticipation -> lunge -> impact -> recovery cycle.
    attacked = anchored_rotate(base, (2, -3, -7, -2)[frame])
    return offset(attacked, (0, 1, 4, 2)[frame], (0, 0, -1, 0)[frame])


def direction_frame(frame: Image.Image, direction: str) -> Image.Image:
    if direction == "left":
        return frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if direction == "up":
        back = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        # Rear-facing frames are slightly shaded, matching northwest lighting.
        alpha = back.getchannel("A")
        rgb = ImageEnhance.Brightness(back.convert("RGB")).enhance(0.86).convert("RGBA")
        rgb.putalpha(alpha)
        return rgb
    return frame


def build_sheet(base: Image.Image, kind: str) -> Image.Image:
    sheet = Image.new("RGBA", (CELL * FRAMES, CELL * len(DIRECTIONS) * len(ANIMATIONS)), (0, 0, 0, 0))
    animal = kind == "animal"
    for direction_index, direction in enumerate(DIRECTIONS):
        for animation_index, animation in enumerate(ANIMATIONS):
            row = direction_index * len(ANIMATIONS) + animation_index
            for frame in range(FRAMES):
                animated = action_frame(base, animation, frame, animal)
                animated = direction_frame(animated, direction)
                sheet.alpha_composite(animated, (frame * CELL, row * CELL))
    return sheet


def main() -> None:
    loaded: dict[str, Image.Image] = {}
    count = 0
    for profile in profiles():
        source = loaded.get(profile.source)
        if source is None:
            source = Image.open(ASSETS / "source_sheets" / profile.source).convert("RGBA")
            loaded[profile.source] = source
        base = normalize(crop_cell(source, profile.row, profile.col), profile.height)
        destination = ASSETS / profile.category
        destination.mkdir(parents=True, exist_ok=True)
        build_sheet(base, profile.kind).save(destination / f"{profile.name}.png", optimize=True)
        count += 1
    print(f"Prepared {count} animated entity sheets ({count * len(DIRECTIONS) * len(ANIMATIONS) * FRAMES} frames).")


if __name__ == "__main__":
    main()
