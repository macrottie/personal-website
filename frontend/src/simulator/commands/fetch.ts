import { Command } from ".";
import fonts from "../fonts";
import { RenderableText } from "../texthelper";
import Bowser from "bowser";

const browser = Bowser.getParser(window.navigator.userAgent);

export const fastfetch: Command = async (_args, sim) => {
    let res = await fetch("./that_fucking_bird_that_i_hate.png");
    let img = await window.createImageBitmap(await res.blob());

    sim.renderer.addImageToScene(img, 25, 12.5, 0);
    
    let indent = " ".repeat(27);
    let renderParts: RenderableText = [];

    let username = sim.state.env.USER;
    let hostname = sim.fs.get("/etc/hostname").toString();

    renderParts.push(
        indent,
        {text: username, color: 14},
        "@",
        {text: hostname, color: 14},
        "\n",
        indent,
        "-".repeat(username.length + hostname.length + 1),
        "\n"
    );

    let stuff: Record<string, string> = {
        OS: "Arch Linux x86_64",
        Host: browser.getBrowserName() + ` (${browser.getBrowserVersion()})`,
        Kernel: browser.getEngineName().toLowerCase() + `-${browser.getOSName().toLowerCase()}${browser.getOSVersion() ? `-${browser.getOSVersion()}` : ""}`,
        Shell: "fake-fish 0.0.1",
        "Display (X27U X2)": "2560x1440 in 32\", 240 Hz [External] *",
        "Display (XV275K P3)": "3840x2160 @ 1.7x in 27\", 144 Hz [External, HDR]",
        "Display (MSI G273)": "1920x1080 in 27\", 165 Hz [External]",
        DE: "KDE Plasma",
        Font: "Noto Sans (10pt) [Qt], Noto Sans (10pt) [GTK2/3/4]",
        Cursor: "breeze (24px)",
        Terminal: "macro.pet",
        "Terminal Font": `${fonts.normal} (${sim.fontSize}px)`,
        CPU: "12th Gen Intel(R) Core(TM) i9-12900K (24) @ 5.20 GHz",
        GPU: "AMD Radeon RX 9070 XT [Discrete]",
        Memory: "64GB",
        Locale: "C.UTF-8"
    }

    Object.keys(stuff).forEach( (key) => {
        renderParts.push(
            indent,
            {text: key, color: 14},
            ": ",
            stuff[key],
            "\n"
        );
    });

    for(let i = 0; i < 16; i++){
        if( ((i) % 8) == 0) renderParts.push("\n"+indent);
        renderParts.push({text:"   ", backgroundColor: i});
    }

    sim.renderer.renderText(renderParts);

    return "\n"
}