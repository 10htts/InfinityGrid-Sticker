import re

with open('assets/css/app.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace variables
css = re.sub(
    r':root\s*\{.*?\}(?=\s*\* \{)',
    """:root {
    --bg-primary: #0A0A0F;
    --bg-secondary: rgba(22, 22, 30, 0.7);
    --bg-tertiary: rgba(30, 30, 42, 0.6);
    --accent: #E11D48;
    --accent-hover: #F43F5E;
    --accent-glow: rgba(225, 29, 72, 0.4);
    --text-primary: #F8FAFC;
    --text-secondary: #94A3B8;
    --border-color: rgba(255, 255, 255, 0.08);
    --success: #10B981;
    --warning: #F59E0B;
    --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    --shadow-glow: 0 0 20px var(--accent-glow);
    --font-heading: 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
}
""",
    css,
    flags=re.DOTALL
)

# Add font import at the top
css = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap');\n\n" + css

# Replace body font
css = re.sub(
    r"font-family: -apple-system.*?;",
    "font-family: var(--font-body);\n            background: radial-gradient(circle at top right, #1E1225, var(--bg-primary) 50%);\n            background-attachment: fixed;",
    css
)

# Replace .header
css = re.sub(
    r'\.header\s*\{.*?\}(?=\s*\.header h1)',
    """.header {
            background: var(--bg-secondary);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.5rem;
            position: sticky;
            top: 0;
            z-index: 100;
        }""",
    css,
    flags=re.DOTALL
)

# Replace .header h1
css = re.sub(
    r'\.header h1\s*\{.*?\}(?=\s*\.header h1::before)',
    """.header h1 {
            font-family: var(--font-heading);
            font-size: 1.4rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: linear-gradient(135deg, #F8FAFC 0%, #94A3B8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }""",
    css,
    flags=re.DOTALL
)

# Replace .header h1::before
css = re.sub(
    r'\.header h1::before\s*\{.*?\}(?=\s*\.icon-count)',
    """.header h1::before {
            content: "◧";
            -webkit-text-fill-color: var(--accent);
            text-shadow: 0 0 10px var(--accent-glow);
        }""",
    css,
    flags=re.DOTALL
)

# Replace buttons
css = re.sub(
    r'/\*\s*Buttons\s*\*/.*?\.btn-sm\s*\{.*?\}',
    """/* Buttons */
        .btn {
            padding: 0.6rem 1.5rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-family: var(--font-heading);
            font-size: 0.95rem;
            font-weight: 600;
            transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            letter-spacing: 0.3px;
        }
        .btn-primary {
            background: linear-gradient(135deg, var(--accent), #BE123C);
            color: white;
            box-shadow: 0 4px 15px rgba(225, 29, 72, 0.3);
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
        }
        .btn-secondary {
            background: var(--bg-tertiary);
            backdrop-filter: blur(10px);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
        }
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }
        .btn-danger {
            background: transparent;
            color: var(--accent);
            border: 1px solid var(--accent);
        }
        .btn-danger:hover {
            background: var(--accent);
            color: white;
            box-shadow: 0 4px 15px rgba(225, 29, 72, 0.3);
        }
        .btn-sm {
            padding: 0.4rem 1rem;
            font-size: 0.85rem;
        }""",
    css,
    flags=re.DOTALL
)

# Replace tag-card
css = re.sub(
    r'\.tag-card\s*\{.*?\}(?=\s*\.tag-card:hover)',
    """.tag-card {
            background: rgba(22, 22, 30, 0.4);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-radius: 16px;
            padding: 1.5rem;
            border: 1px solid var(--border-color);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }""",
    css,
    flags=re.DOTALL
)

css = re.sub(
    r'\.tag-card:hover\s*\{.*?\}(?=\s*\.tags-table)',
    """.tag-card:hover {
            border-color: rgba(225, 29, 72, 0.5);
            box-shadow: var(--shadow-glow), 0 20px 25px -5px rgba(0, 0, 0, 0.3);
            transform: translateY(-5px) scale(1.02);
            background: rgba(22, 22, 30, 0.6);
        }""",
    css,
    flags=re.DOTALL
)

# Replace modal
css = re.sub(
    r'\.modal\s*\{.*?\}(?=\s*\.modal-overlay)',
    """.modal {
            background: rgba(22, 22, 30, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow), 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            width: 100%;
            max-width: 100%;
            max-height: 100vh;
            overflow-y: auto;
            transform: scale(0.95);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }""",
    css,
    flags=re.DOTALL
)

with open('assets/css/app.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('CSS updated successfully')
