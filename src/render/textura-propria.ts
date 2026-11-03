import { ImageSource, Texture } from 'pixi.js';

/**
 * Uma textura com fonte própria para um bitmap do baker. `Texture.from(bitmap)` reaproveita a fonte de quem já usa o mesmo bitmap (a cena, quando o mesmo desenho
 * está no mapa), e destruir essa fonte derrubaria a textura de quem ainda a usa ("Cannot read properties of null (reading 'alphaMode')").
 * Quem cria por aqui pode destruir com `destroy(true)` sem afetar ninguém.
 */
export const texturaPropria = (bitmap: ImageBitmap): Texture => new Texture({ source: new ImageSource({ resource: bitmap }) });
