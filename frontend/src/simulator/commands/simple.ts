// simple commands that are one liners or are otherwise very easy and short to implement

import TerminalSimulator from "..";
import nodepath from "path-browserify";
import { RenderableText, TextType } from "../texthelper";
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import { Emitter } from "highlight.js";

hljs.registerLanguage('javascript', javascript);

function echo(args: string[], _sim: TerminalSimulator){
    return args.join(" ") + "\n";
};

function clear(_args: string[], sim: TerminalSimulator){
    sim.renderer.scene.chars = [];
    sim.renderer.scene.images = [];
    sim.state.cursor.position = {x: 0, y: 0};
    return "";
}

// syntax highlighter shit

// yoinked from hljs src, since this isnt exported
const scopeToCSSClass = (name: string, { prefix }: {prefix: string} ) => {
  // sub-language
  if (name.startsWith("language:")) {
    return name.replace("language:", "language-");
  }
  // tiered scope: comment.line
  if (name.includes(".")) {
    const pieces = name.split(".");
    return [
      `${prefix}${pieces.shift()}`,
      ...(pieces.map((x, i) => `${x}${"_".repeat(i + 1)}`))
    ].join(" ");
  }
  // simple scope
  return `${prefix}${name}`;
};

type Token = {children: Token[], scope: string} | string;
interface ExtendedEmitter extends Emitter {
    stack: Token[],
}

function highlight(code: string): RenderableText {
    let highlighted = hljs.highlight(code, {"language": "javascript"})._emitter as ExtendedEmitter;
    let partsToRender: TextType[] = [];

    let potentialTestElement: HTMLSpanElement | null = document.getElementById("color-test");
    let testElement: HTMLSpanElement;

    if(!potentialTestElement){
        testElement = document.createElement("span");
        testElement.id = "color-test";
        document.body.appendChild(testElement);
    } else {
        testElement = potentialTestElement;
    }

    function handleToken(t: Token, scope?: string){
        if(typeof t === "string"){
            if(!scope){
                return partsToRender.push(t);
            } else {
                testElement.className = scopeToCSSClass(scope, {prefix: "hljs-"});
                return partsToRender.push({"text": t, color: window.getComputedStyle(testElement).color});
            }
        }

        t.children.forEach( (token) => {
            handleToken(token, t.scope);
        })
    }

    highlighted.stack.forEach((t) => {
        handleToken(t);
    })
    
    return partsToRender;
}

function cat(args: string[], sim: TerminalSimulator){
    args.forEach( (path, idx) => {
        if(idx > 0) sim.renderer.renderText("\n");

        let absPath = sim.fs.resolve(sim.state.env.PWD, path);
        if(!sim.fs.exists(absPath)) return sim.renderer.renderText(`cat: ${path}: No such file or directory`)
        let potentialFile = sim.fs.get(absPath);

        if(sim.fs.isDirectory(potentialFile)) return sim.renderer.renderText(`cat: ${path}: Is a directory`);
        if(typeof potentialFile === "function"){
            // syntax highlighting, because why not.
            return sim.renderer.renderText(highlight(potentialFile.toString()));
        }
        
        sim.renderer.renderText(potentialFile.toString());
    });

    return "\n";
}

function env(_args: string[], sim: TerminalSimulator){
    Object.keys(sim.state.env).forEach((k) => {
        sim.renderer.renderText(`${k}=${sim.state.env[k]}\n`);
    });
    return "";
}

function ls(args: string[], sim: TerminalSimulator){
    let options = args.filter( (a) => a.startsWith("-") );
    let path = args.filter( (a) => !a.startsWith("-") )[0] || "./";
    let realpath = sim.fs.resolve(sim.state.env.PWD, path);

    if(!sim.fs.exists(realpath)) return `ls: ${path}: No such file or directory\n`;
    
    let folder = sim.fs.get(realpath);

    if(!sim.fs.isDirectory(folder)) return `ls: ${path}: Not a directory\n`;

    let namesSorted = Object.keys(folder).sort();

    if(namesSorted.length === 0) return "";

    if(!options.includes("-a") && !options.includes("--all")) namesSorted = namesSorted.filter( (n) => !n.startsWith(".") );

    let cols = 0;
    let colinfo: {width: number, files: string[]}[] = [];
    let maxColsReached = false;

    function tryIncrementCols(): boolean {
        let newcols = cols + 1;

        let newcolinfo: {width: number, files: string[]}[] = [];

        for(let i = 0; i < newcols; i++) newcolinfo.push({width:0, files:[]});

        namesSorted.forEach( (file, idx) => {
            let isDir = sim.fs.isDirectory(sim.fs.get(nodepath.join(realpath, file)));
            let len = file.length + (isDir ? 1 : 0) + (idx === namesSorted.length - 1 ? 0 : 3);
            let col = Math.floor(idx / (namesSorted.length / newcols));

            if(len > newcolinfo[col].width) newcolinfo[col].width = len;
            newcolinfo[col].files.push(file);
        });

        let totalWidth = 0;

        newcolinfo.forEach( (c) => totalWidth += c.width );

        let possible = totalWidth <= sim.size.x;
        if(possible){
            cols = newcols;
            colinfo = newcolinfo;
        }

        return possible;
    }

    while(!maxColsReached){
        maxColsReached = !tryIncrementCols();
        if(cols === namesSorted.length) maxColsReached = true;
    }

    // rendering
    let lines = Math.ceil(namesSorted.length / cols);

    for(let line = 0; line < lines; line++){
        let lineContent: RenderableText = [];

        for(let col = 0; col < cols; col++){
            let file = colinfo[col].files[line];
            if(file === undefined) continue;
            
            let content = sim.fs.get(nodepath.join(realpath, file));
            let isDir = sim.fs.isDirectory(content);
            let isExec = typeof content === "function";
            let len = file.length + (isDir ? 1 : 0);


            lineContent.push({"text": file, "color": isDir ? 4 : isExec ? 2 : 7});
            if(isDir) lineContent.push("/");
            if(isExec) lineContent.push("*");
            lineContent.push(" ".repeat(colinfo[col].width - len));
        }

        lineContent.push("\n");

        sim.renderer.renderText(lineContent);
    }

    return "";
}

function cd(args: string[], sim: TerminalSimulator){
    if(args.length > 1) return "Too many args for cd command\n";
    if(args.length == 0) return "";

    let dir = args[0];
    let absolute = sim.fs.resolve(sim.state.env.PWD, dir);

    if(!sim.fs.exists(absolute)) return `cd: The directory '${dir}' does not exist\n`;
    if(!sim.fs.isDirectory(sim.fs.get(absolute))) return `cd: ${dir} is not a directory\n`;

    sim.state.env.PWD = absolute;

    return "";
}

function evaluate(args: string[], sim: TerminalSimulator){
    let res = "";
    try {
        res = String(eval(args.join(" ")));
    } catch(err){
        res = String(err);
    }
    return res + "\n";
}

export default {echo, clear, cat, env, ls, cd, eval: evaluate}