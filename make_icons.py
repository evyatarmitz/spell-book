from PIL import Image
import os

src = r"C:\Users\USER\AI_Agency\Spell Book\public\logo.png"
icons_dir = r"C:\Users\USER\AI_Agency\Spell Book\src-tauri\icons"
os.makedirs(icons_dir, exist_ok=True)

img = Image.open(src).convert("RGBA")
w, h = img.size
size = max(w, h)
square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
square.paste(img, ((size - w) // 2, (size - h) // 2))

for dim in [32, 128, 256]:
    square.resize((dim, dim), Image.LANCZOS).save(os.path.join(icons_dir, f"{dim}x{dim}.png"))

square.resize((128, 128), Image.LANCZOS).save(os.path.join(icons_dir, "128x128@2x.png"))
square.resize((512, 512), Image.LANCZOS).save(os.path.join(icons_dir, "icon.png"))

ico_sizes = [16, 32, 48, 256]
frames = [square.resize((s, s), Image.LANCZOS) for s in ico_sizes]
frames[0].save(
    os.path.join(icons_dir, "icon.ico"),
    format="ICO",
    sizes=[(s, s) for s in ico_sizes],
    append_images=frames[1:],
)

print("Icons generated:", sorted(os.listdir(icons_dir)))
