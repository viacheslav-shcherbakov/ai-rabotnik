# -*- coding: utf-8 -*-
import os
import shutil

OLD = r"C:\SVNFT\ai-rabotnik-old"
AV = os.path.join(OLD, "avatars")
NEW = r"C:\SVNFT\ai-rabotnik\assets"

# target mapping keyed by the CORRECT Cyrillic filename
role_map = {
    "юрист3.png":     os.path.join(NEW, "img", "roles", "lawyer.png"),
    "бухгалтер.jpg":  os.path.join(NEW, "img", "roles", "accountant.jpg"),
    "продавец.jpeg":  os.path.join(NEW, "img", "roles", "sales.jpeg"),
    "кадровик.png":   os.path.join(NEW, "img", "roles", "hr.png"),
    "ассистент.jpg":  os.path.join(NEW, "img", "roles", "support.jpg"),
    "аналитик3.png":  os.path.join(NEW, "img", "roles", "analyst.png"),
}

icon_map = [
    (os.path.join(OLD, "android-chrome-192x192.png"), os.path.join(NEW, "icons", "android-chrome-192.png")),
    (os.path.join(OLD, "android-chrome-512x512.png"), os.path.join(NEW, "icons", "android-chrome-512.png")),
    (os.path.join(OLD, "apple-touch-icon.png"),       os.path.join(NEW, "icons", "apple-touch-icon.png")),
    (os.path.join(OLD, "favicon-16x16.png"),          os.path.join(NEW, "icons", "favicon-16.png")),
    (os.path.join(OLD, "favicon-32x32.png"),          os.path.join(NEW, "icons", "favicon-32.png")),
]

# robot logo
robot_src = os.path.join(AV, "robot_kit.jpg")
robot_dst = os.path.join(NEW, "img", "logo-robot.png")

copied = []
missing = []

# --- robot logo (ascii, direct) ---
if os.path.isfile(robot_src):
    os.makedirs(os.path.dirname(robot_dst), exist_ok=True)
    shutil.copy2(robot_src, robot_dst)
    copied.append(robot_dst)
    print("COPIED: %s -> %s (%d bytes)" % (robot_src, robot_dst, os.path.getsize(robot_dst)))
else:
    missing.append(robot_src)
    print("MISSING: %s" % robot_src)

# --- roles (cyrillic, recover name from mojibake) ---
recovered = {}
for f in os.listdir(AV):
    try:
        rec = f.encode("cp437").decode("utf-8")
    except Exception:
        rec = f
    recovered[rec] = f

for real_name, dst in role_map.items():
    if real_name in recovered:
        src = os.path.join(AV, recovered[real_name])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        copied.append(dst)
        print("COPIED: %s [%s] -> %s (%d bytes)" % (recovered[real_name], real_name, dst, os.path.getsize(dst)))
    else:
        missing.append(real_name)
        print("MISSING: %s" % real_name)

# --- icons (ascii, direct) ---
for src, dst in icon_map:
    if os.path.isfile(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        copied.append(dst)
        print("COPIED: %s -> %s (%d bytes)" % (src, dst, os.path.getsize(dst)))
    else:
        missing.append(src)
        print("MISSING: %s" % src)

print("\n=== TARGET LISTING ===")
for sub in ["img", "img/roles", "icons"]:
    d = os.path.join(NEW, sub)
    if os.path.isdir(d):
        print("\n[%s]" % d)
        for f in sorted(os.listdir(d)):
            p = os.path.join(d, f)
            print("  %s  (%d bytes)" % (f, os.path.getsize(p)))

print("\nSUMMARY: copied=%d missing=%d" % (len(copied), len(missing)))
