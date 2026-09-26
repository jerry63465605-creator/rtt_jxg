# generate SVG from hires PNG
node tools/hexbevel.js

# resample to final sizes
for F in tools/tiles/hex*/*.svg
do
	X=${F/svg/png}
	O1=${X/tools\/tiles/tiles75}
	O2=${X/tools\/tiles/tiles150}
	echo render $X $O1
	convert -background none -colorspace RGB -resize 12.5% -colorspace sRGB $F $O1
	echo render $X $O2
	convert -background none -colorspace RGB -resize 25% -colorspace sRGB $F $O2
done
