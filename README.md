# ProjectorRaysWeb
**ProjectorRaysWeb** is a client-side, browser-based port of ProjectorRays. It allows users to decompile Adobe/Macromedia Shockwave files (DCR, DXR, CCT, CXT) directly in the browser using JavaScript.

It is a port of the C++ version of [ProjectorRays](https://github.com/ProjectorRays/ProjectorRays). 

# Features
Browser-Native: No executable downloads or command-line tools required. Works entirely within your web browser.

Local Processing: Your files never leave your computer. All decompilation happens locally via WebAssembly, ensuring privacy and speed.

## File Support:

- DCR/DXR (Movies) -> DIR (Editable Movies)

- CCT/CXT (Casts) -> CST (Editable Casts)

- Script Reconstruction: Reverses the "protection" process to recover Lingo scripts from published files.

- Drag-and-Drop: Simple web interface for batch processing multiple files.
