import { Command } from ".";

export const icat: Command = async (args, sim) => {
    let res = await fetch(args[0]);
    let img = await window.createImageBitmap(await res.blob());
    let height = parseInt(args[2]) || 3;

    sim.renderer.addImageToScene(img, parseInt(args[1]) || undefined, parseInt(args[2]) || undefined);
    sim.renderer.renderText("\n".repeat(height));

    return "";
}