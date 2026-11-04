"""2dFGRS best.observations.idz -> the NGP and SGP strips projected onto a plane, as int16 (x, y) in Mpc.
usage: python make_2dfgrs_slices.py best.observations.idz.gz 2dfgrs-slices.bin
(catalogue: http://www.2dfgrs.net/Public/Release/SpecCat/)"""
import gzip, math, sys, struct
import numpy as np
# Ryden benchmark: H0=68, Om=0.31, OL=0.69 (radiation ignored here)
c, H0, Om, OL = 299792.458, 68.0, 0.31, 0.69
zs = np.linspace(0, 0.4, 4001)
Ez = np.sqrt(Om*(1+zs)**3 + OL)
Dc = c/H0*np.concatenate([[0], np.cumsum((1/Ez[1:]+1/Ez[:-1])/2*np.diff(zs))])
def deg(h, m, s): return 15*(int(h)+int(m)/60+float(s)/3600)
def decd(d, m, s):
    sg = -1 if d.startswith('-') else 1
    return sg*(abs(int(d))+int(m)/60+float(s)/3600)
strips = {'ngp': (-7.5, 2.5, 147.5, 222.5, -1), 'sgp': (-37.5, -22.5, 325.0, 52.5, +1)}
pts = {k: [] for k in strips}
for line in gzip.open(sys.argv[1], 'rt'):
    t = line.split()
    if len(t) < 27: continue
    q = int(t[26]); z = float(t[24])
    if q < 3 or not (0.002 < z < 0.25): continue
    ra = deg(*t[10:13]); dec = decd(*t[13:16])
    for k, (d0, d1, r0, r1, side) in strips.items():
        if not (d0 <= dec < d1): continue
        span = (r1 - r0) % 360; off = (ra - r0) % 360
        if off > span: continue
        a = math.radians(off - span/2)   # angle from the strip's centre line
        D = float(np.interp(z, zs, Dc))
        pts[k].append((side*D*math.cos(a), D*math.sin(a)))
for k in pts: print(k, len(pts[k]), 'span', (strips[k][3]-strips[k][2]) % 360)
allp = np.array(pts['ngp'] + pts['sgp'])
np.round(allp).astype('<i2').tofile(sys.argv[2])
print('total', len(allp), 'Dmax', float(np.interp(0.25, zs, Dc)), 'D(0.05,0.1,0.15,0.2)', [round(float(np.interp(z, zs, Dc))) for z in (0.05,.1,.15,.2)])
