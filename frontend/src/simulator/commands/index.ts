import TerminalSimulator from "..";
import { EmulatedFolder } from "../filesystem";
import { fastfetch } from "./fetch";
import { icat } from "./icat";
import { lastfm } from "./lastfm";
import simple from "./simple";

export type Command = (args: string[], sim: TerminalSimulator) => string | Promise<string>;

export let bin: EmulatedFolder = {...simple, lastfm, fastfetch, icat};