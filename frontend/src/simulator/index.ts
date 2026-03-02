import CanvasRenderer from "./renderer"
import type { RenderableText } from "./texthelper"
import fonts from "./fonts"
import { EmulatedFilesystem } from "./filesystem"
import { bin, Command } from "./commands"

export interface Vector2 {
    x: number,
    y: number
}

interface TerminalState {
    cursor: {
        visible: boolean,
        position: Vector2
    },
    textColor: number // default text color
    env: Record<string, string>,
    process: Promise<string> | string | null,
    history: {
        items: string[],
        browsing: boolean,
        pos: number
    }
}
interface PromptState {
    command: string
    startPos: Vector2
    cursor: number // index of where the cursor is relative to command
}

let palette = ["rgba(0,0,0,0)", "#cc0403", "#19cb00", "#cecb00", "#0d73cc", "#cb1ed1", "#0dcdcd", "#dddddd",
                     "#767676", "#f2201f", "#23fd00", "#fffd00", "#1a8fff", "#fd28ff", "#14ffff", "#ffffff"]

const prompt = [
    {color: 14, text: "┌["},
    "macro",
    {color: 14, text: "@"},
    "fagbox-9002",
    {color: 14, text: "]"},
    "-",
    {color: 14, text: "("},
    "~",
    {color: 14, text: ")"},
    "\n",
    {color: 14, text: "└> "}
]

export default class TerminalSimulator {
    renderer: CanvasRenderer;
    palette: string[];
    state: TerminalState;
    size: Vector2;
    fontSize: number;
    fontHeight: number;
    promptState: PromptState;
    fs: EmulatedFilesystem;

    constructor(canvas: HTMLCanvasElement, fontSize: number){
        this.renderer = new CanvasRenderer(canvas, this);
        this.renderer.ctx.font = `${fontSize}px ${fonts["normal"]}`
        this.fontSize = fontSize
        this.palette = palette;
        this.fs = new EmulatedFilesystem();
        this.state = {
            cursor: {
                visible: true,
                position: {x: 0, y: 0}
            },
            textColor: 7,
            env: {
                PATH: "/usr/bin:/usr/local/bin",
                HOME: "/home/macro",
                XDG_SESSION_TYPE: "tty",
                LOGNAME: "macro",
                USER: "macro",
                SHELL: "/usr/bin/fish",
                LANG: "C.UTF-8",
                PWD: "/home/macro",
                XDG_SESSION_CLASS: "user",
                TERM: "browser"
            },
            process: null,
            history: {
                items: [],
                browsing: false,
                pos: -1,
            }
        };
        this.promptState = {
            command: "", 
            startPos: { x: 0, y: 0 },
            cursor: 0
        };
        // these declarations are useless, but are required to make the typescript compiler happy.
        this.size = {x: 0, y: 0};
        this.fontHeight = 0;
        
        const resizeTerminal = () => {
            // measure font metrics for accurate terminal character grid
            let measure = this.renderer.ctx.measureText("|");

            this.fontHeight = measure.fontBoundingBoxAscent + measure.fontBoundingBoxDescent;
            this.renderer.charWidth = measure.width;

            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;

            this.size = {x: Math.floor(canvas.clientWidth / measure.width), y: Math.floor(canvas.clientHeight / this.fontHeight)};
        };

        resizeTerminal();

        window.addEventListener("resize", () => {
            resizeTerminal();
            this.renderer.renderScene();
            this.renderer.renderCursor();
        });

        // shitty mobile-inclusive stuff
        const inputContainer = document.createElement("div")
        const inputElem = document.createElement("input");

        document.body.appendChild(inputContainer);
        inputContainer.appendChild(inputElem);

        inputContainer.style.overflow = "hidden";
        inputContainer.style.position = "relative";

        inputElem.style.display = "block";
        inputElem.style.position = "absolute";
        inputElem.style.right = "5000px";

        canvas.addEventListener("touchend", (e) => {
            inputElem.focus();
            e.preventDefault();
        });

        // temporary welcome message
        this.renderer.renderText("Hello! Welcome to my VERY work in progress personal site.\ntheres not much currently implemented, other than a basic filesystem + the lastfm and fastfetch commands\n")

        // init first prompt
        this.initPrompt();

        let validkeys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/.,?><';\":\\][]|}{=-+_`~ 1234567890!@#$%^&*()";
        // register input
        window.addEventListener("keydown", async (e) => {
            // console.log(e.key);
            if(this.state.process !== null) return; // todo: pass input to processes expecting it

            switch(e.key){
                case "Enter":
                    await this.executeCommand();
                    this.initPrompt();
                break;
                case "ArrowLeft":
                    this.promptState.cursor--;
                break;
                case "ArrowRight":
                    this.promptState.cursor++;
                break;
                case "ArrowUp":
                    var history = this.state.history;

                    if(this.promptState.command !== "" && !history.browsing) break;
                    if(history.items.length === 0) break;
                    
                    history.browsing = true;
                    history.pos = Math.min(history.items.length-1, history.pos+1);
                    this.promptState.command = history.items[history.pos];
                    this.promptState.cursor = this.promptState.command.length;
                    this.renderPrompt();
                break;
                case "ArrowDown":
                    var history = this.state.history;

                    if(this.promptState.command !== "" && !history.browsing) break;
                    if(history.items.length === 0) break;
                    
                    history.pos = Math.max(-1, history.pos-1);
                    history.browsing = history.pos !== -1;

                    this.promptState.command = history.browsing ? history.items[history.pos] : "";
                    this.promptState.cursor = this.promptState.command.length;
                    this.renderPrompt();
                break;
                case "Backspace":
                    let before = this.promptState.command.substring(0, this.promptState.cursor-1);
                    let after = this.promptState.command.substring(this.promptState.cursor);

                    this.promptState.command = before + after;
                    this.promptState.cursor--;
                break;    
                default:
                    if(validkeys.includes(e.key)){
                        if(!e.ctrlKey && !e.shiftKey) e.preventDefault();

                        let before = this.promptState.command.substring(0, this.promptState.cursor);
                        let after = this.promptState.command.substring(this.promptState.cursor);

                        this.promptState.command = before + e.key + after;
                        this.promptState.cursor++;
                    }
            }
            // clamp cursor pos, incase it changed via backspace / arrow keys
            this.promptState.cursor = Math.min(Math.max(this.promptState.cursor, 0), this.promptState.command.length);
                
            // cancel history browsing if needed
            if(this.state.history.browsing && e.key !== "ArrowUp" && e.key !== "ArrowDown"){
                this.state.history.browsing = false;
                this.state.history.pos = -1;
            }

            // render the prompt
            this.renderer.pauseCursorBlinking();
            this.renderPrompt();
        });
        
        // initalize the fake filesystem
        this.fs.mkdir("/home");
        this.fs.mkdir("/home/macro");
        this.fs.mkdir("/home/macro/.secrets");

        this.fs.mkdir("/usr");
        this.fs.mkdir("/usr/bin");

        this.fs.mkdir("/etc")

        // add commands to bin

        let commands = {...bin};
        
        Object.keys(commands).forEach( (key) => {
            this.fs.writeFile("/usr/bin/" + key, commands[key] as Command);
        });

        // init filesystem
        // TODO: move this somewhere else..?
        this.fs.writeFile("/home/macro/sexuality", "pansexual");
        this.fs.writeFile("/home/macro/gender", "non-binary / genderfluid");
        this.fs.writeFile("/home/macro/pronouns", "he/she/they");
        this.fs.writeFile("/home/macro/socials", "you can find me at various places on the internet\nto name a few:"
            + "\ndiscord: macrottie"
            + "\nsoulseek: macro"
            + "\nlast.fm: macrotheavali"
            + "\nroblox: linux_avali"
            + "\nmore: http://macro.theava.li/"
        )

        this.fs.writeFile("/etc/hostname", "fagbox-9002");
    }
    async executeCommand(){
        let args = this.promptState.command.split(" ");
        
        this.renderer.renderText("\n");

        // Taking advantage of the `.every` function on arrays to exit the loop as soon as a command in PATH has been found.
        let command: Command | undefined;
        
        this.state.env.PATH.split(":").every( (pathDir) => {
            if(!this.fs.exists(pathDir)) return true;
            let dir = this.fs.get(pathDir);

            if(this.fs.isDirectory(dir) && args[0] in dir){
                let cmd = dir[args[0]];
                if(typeof cmd === "function"){
                    command = cmd;
                    return false; // gets us out of loop
                }
            }
        });

        // if path checks fail, try looking for it in the filesystem
        let resolved = this.fs.resolve(this.state.env.PWD, args[0]);
        let isFile = this.fs.exists(resolved);
        if(command === undefined && isFile){
            let potentialCommand = this.fs.get(resolved);

            if(typeof potentialCommand === "function"){
                command = potentialCommand;
            }
        }

        if(typeof command === "function"){
            try {
                let res = command(args.slice(1), this);

                this.state.process = res;
                res = await Promise.resolve(res);

                this.renderer.renderText(res);
            } catch(err){
                if(typeof err === "string") this.renderer.renderText(err);
            }
        } else {
            this.renderer.renderText(`fish: Unknown command${isFile ? `. '${args[0]}' exists but is not an executable file.` : `: ${args[0]}`}\n`);
        }

        if(this.state.history.items[0] !== this.promptState.command) this.state.history.items.unshift(this.promptState.command);
        this.state.process = null;
    }
    private initPrompt(){
        let pathReplaced = structuredClone(prompt);

        for(let i = 0; i < pathReplaced.length; i++){
            let renderable = pathReplaced[i];
            let text = typeof renderable === "object" ? renderable.text : renderable;

            text = text.replace("~", this.state.env.PWD.replace(this.state.env.HOME, "~"))

            typeof renderable === "object" ? renderable.text = text : renderable = text;

            pathReplaced[i] = renderable;
        }

        this.renderer.renderText(pathReplaced);
        this.promptState = {
            command: "",
            cursor: 0,
            startPos: structuredClone(this.state.cursor.position)
        }
    }
    private renderPrompt(){
        this.state.cursor.position = {...this.promptState.startPos};
        this.renderer.renderText(this.promptState.command + " ".repeat(99)); // 
        this.state.cursor.position.x = this.promptState.startPos.x + this.promptState.cursor;
    }
}