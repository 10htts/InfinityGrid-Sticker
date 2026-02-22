import requests

svg = '<svg xmlns="http://www.w3.org/2000/svg" width="34.5mm" height="10.5mm" viewBox="0 0 34.5 10.5"><path fill-rule="evenodd" fill="black" d="M 0 0 L 34.5 0 L 34.5 10.5 L 0 10.5 Z" /></svg>'
data = {'svg_content': svg, 'width': 34.5, 'height': 10.5}

response = requests.post("http://localhost:3000/api/export_step", data=data)
if response.status_code == 200:
    with open("test.step", "wb") as f:
        f.write(response.content)
    print("Success. Saved test.step")
else:
    print("Failed", response.text)
