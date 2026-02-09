"""Debug script: Reads a binary STL and prints a top-view ASCII map of the content layer."""
import struct, sys

def read_binary_stl(path):
    with open(path, 'rb') as f:
        header = f.read(80)
        num_tri = struct.unpack('<I', f.read(4))[0]
        triangles = []
        for _ in range(num_tri):
            data = struct.unpack('<12fH', f.read(50))
            normal = data[0:3]
            v1, v2, v3 = data[3:6], data[6:9], data[9:12]
            triangles.append((normal, [v1, v2, v3]))
    return triangles

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'output.stl'
    triangles = read_binary_stl(path)

    # Separate base vs content triangles
    content = [t for t in triangles if any(v[2] > 0.79 for v in t[1])]
    base = [t for t in triangles if all(v[2] <= 0.79 for v in t[1])]

    print(f"Total triangles: {len(triangles)}")
    print(f"Base triangles:  {len(base)}")
    print(f"Content triangles: {len(content)}")

    if not content:
        print("No content layer found!")
        return

    # Bounding box of content
    xs = [v[0] for t in content for v in t[1]]
    ys = [v[1] for t in content for v in t[1]]
    print(f"Content X range: {min(xs):.2f} to {max(xs):.2f} ({max(xs)-min(xs):.2f}mm)")
    print(f"Content Y range: {min(ys):.2f} to {max(ys):.2f} ({max(ys)-min(ys):.2f}mm)")

    # Create ASCII top-view (X horizontal, Y vertical)
    res = 0.5  # mm per character
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    cols = int((x_max - x_min) / res) + 1
    rows = int((y_max - y_min) / res) + 1
    grid = [[' '] * cols for _ in range(rows)]

    # Mark top-face triangles (normal Z > 0.5 and z ~ 1.0)
    for normal, verts in content:
        if normal[2] < 0.5:
            continue
        for v in verts:
            col = int((v[0] - x_min) / res)
            row = int((y_max - v[1]) / res)  # flip Y
            if 0 <= row < rows and 0 <= col < cols:
                grid[row][col] = '#'

    print(f"\nTop view ({cols}x{rows} chars, {res}mm/char):")
    for row in grid:
        print(''.join(row))

if __name__ == '__main__':
    main()
