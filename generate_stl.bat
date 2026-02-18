@echo off
"C:\Program Files\OpenSCAD\openscad.exe" -o bases/gridfinity_base_1y.stl -D "Y_units=1" -D "Component=\"None\"" gridfinity_bin_label.scad
"C:\Program Files\OpenSCAD\openscad.exe" -o bases/gridfinity_base_2y.stl -D "Y_units=2" -D "Component=\"None\"" gridfinity_bin_label.scad
"C:\Program Files\OpenSCAD\openscad.exe" -o bases/gridfinity_base_3y.stl -D "Y_units=3" -D "Component=\"None\"" gridfinity_bin_label.scad
echo Done!