import { Command } from "./commands"
import path from "path-browserify";

export type EmulatedFile = string | Command

export interface EmulatedFolder {
    [path: string]: EmulatedFolder | EmulatedFile
}

export class EmulatedFilesystem {
    fs: EmulatedFolder;

    constructor(){
        this.fs = {};
    }
    isDirectory(input: EmulatedFolder | EmulatedFile): input is EmulatedFolder {
        return typeof input === "object";
    }
    private opendir(dir: string): EmulatedFolder {
        let directory = this.fs;
        let splitPath = path.normalize(dir).split("/");

        for(let i = 0; i < splitPath.length; i++){
            let next = directory[splitPath[i]];
            if(this.isDirectory(next)){
                directory = next;
            } else if(splitPath[i] === ""){
                continue;
            } else {
                throw `Path '${splitPath.slice(0, i+1).join("/")}' does not exist`
            }
        }

        return directory;
    }
    writeFile(filePath: string, content: EmulatedFile){
        let directory = this.opendir(path.dirname(filePath));

        directory[path.basename(filePath)] = content;
    }
    mkdir(dir: string){
        let directory = this.opendir(path.dirname(dir));

        directory[path.basename(dir)] = {};
    }
    resolve(pwd: string, dir: string){
        return !path.isAbsolute(dir) ? path.join(pwd, dir) : path.normalize(dir);
    }
    exists(location: string): boolean {
        let dirname = path.dirname(location);
        let res = false;
        try {
            let dir = this.opendir(dirname);
            if(path.basename(location) === "" || dir[path.basename(location)] !== undefined) res = true;
        } catch(err){
            res = false;
        }
        return res;
    }
    get(location: string): EmulatedFolder | EmulatedFile {
        let dir = this.opendir(path.dirname(location));

        
        return path.basename(location) !== "" ? dir[path.basename(location)] : dir;
    }
}