import TerminalSimulator from "./simulator";
import Bowser from "bowser";

const browser = Bowser.getParser(
  window.navigator.userAgent
);

( async () => {
    // load fonts
    const fonts = ["Hack-Regular.ttf", "Hack-Bold.ttf", "Hack-Italic.ttf", "Hack-BoldItalic.ttf"];
    
    for(let font of fonts){
        const fontface = new FontFace(font.replace("-", " ").replace(".ttf", ""), `url("./fonts/${font}")`);

        // @ts-ignore - the ts compiler doesn't know that .add is a method on document.fonts for some reason, although every modern browser supports it.
        document.fonts.add(fontface);

        await fontface.load();
    };

    let fontsize = 20;

    if(browser.getPlatformType() === "mobile"){
        fontsize = 15;
    }
    
    let sim = new TerminalSimulator(document.getElementById("terminal") as HTMLCanvasElement, fontsize);
})();
