import { Command } from ".";
import { RenderableText } from "../texthelper";

const sleep = (ms: number) => new Promise<void>( (res, _rej) => {setTimeout(() => {res()}, ms)});

type LastFMRecentTracksResponse = {
    recenttracks: {
        track: {
            "@attr"?: {
                nowplaying: boolean
            },
            name: string,
            artist: {"#text": string},
            album: {"#text": string}
        }[]
    }
}

export const lastfm: Command = async (_args, sim) => {
    // api key stolen from vencord source code :3
    const key = "790c37d90400163a5a5fe00d6ca32ef0";
    let apibase = "https://ws.audioscrobbler.com/2.0/";
    let params = new URLSearchParams();
    let headers = {"headers": {"User-Agent": "https://macro.pet/"}}

    params.set("method", "user.getRecentTracks");
    params.set("user", "macrotheavali");
    params.set("api_key", key);
    params.set("limit", "1");
    params.set("format", "json");

    let resParts: RenderableText = [
        {text: "macro", color: 6, style: "bold"},
        " is "
    ]

    let nowPlayingReq = await fetch(`${apibase}?${params.toString()}`, headers);
    let nowPlaying: LastFMRecentTracksResponse = await nowPlayingReq.json();

    if(nowPlaying.recenttracks.track.length == 2){
        let track = nowPlaying.recenttracks.track[0];
        resParts.push(
            "currently listening to ", 
            {text: track.name, style: "bold", color: 6}, 
            " by ", 
            {text: track.artist["#text"], style: "bold", color: 6}
        );
    } else {
        resParts.push("not currently listening to anything.")
    }

    sim.renderer.renderText(resParts);
    resParts = [];

    // weekly stats

    resParts.push(
        "\n",
        {text: "Weekly Stats:\n", color: 5, style: "bold"},
        "  Top Artists: \n"
    );

    params.set("period", "7day");
    params.set("limit", "3");
    
    async function fetchTop(method: string): Promise<{name: string, playcount: string, artist?: {name: string}}[]> {
        params.set("method", `user.getTop${method}s`);
        let topReq = await fetch(`${apibase}?${params.toString()}`, headers);
        let topJSON = await topReq.json();
        let top = topJSON[`top${method.toLowerCase()}s`][method.toLowerCase()];

        return top;
    }

    async function handleTop(top: {name: string, playcount: string, artist?: {name: string}}[]){
        top.forEach( (topItem, idx) => {
            
            if(Array.isArray(resParts) /* useless type assertion to make typescript stfu */) 
                resParts.push(
                    `    ${idx+1}. `,
                    {text: `${topItem.artist ? `${topItem.artist.name} - ` : ""}${topItem.name}`, color: 6, style: "bold"},
                    " (",
                    {text: topItem.playcount, color: 6, style: "bold"},
                    " plays)",
                    "\n"
                );
        });

        await sleep(500); // to avoid getting ratelimited.
    }
    // top artists
    let topArtists = await fetchTop("Artist");

    handleTop(topArtists);

    sim.renderer.renderText(resParts);
    resParts = [];

    // top albums
    let topAlbums = await fetchTop("Album");

    resParts.push("  Top Albums:\n");

    handleTop(topAlbums);

    sim.renderer.renderText(resParts);
    resParts = [];

    // top tracks
    let topTracks = await fetchTop("Track");

    resParts.push("  Top Tracks:\n");

    handleTop(topTracks);

    sim.renderer.renderText(resParts);
    resParts = [];

    return "\n";
}