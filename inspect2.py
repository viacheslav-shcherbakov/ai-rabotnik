# -*- coding: utf-8 -*-
import os
AV = r"C:\SVNFT\ai-rabotnik-old\avatars"
for f in sorted(os.listdir(AV)):
    try:
        rec = f.encode('cp437').decode('utf-8')
    except Exception as e:
        rec = "?? (%s)" % e
    print("%-50s -> %s" % (f, rec))
