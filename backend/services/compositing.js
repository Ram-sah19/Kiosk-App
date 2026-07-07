const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Composites multiple photos into a single layout template.
 * @param {Array<string>} photoPaths - Paths to the source photo files.
 * @param {Object} template - Template configuration (width, height, slots, overlayImage).
 * @param {string} outputPath - Path to save the final composited image.
 */
async function compositeImages(photoPaths, template, outputPath) {
  try {
    const { width, height, slots, overlayImage } = template;

    // Create a base canvas (blank background)
    // We can use a solid color like black or white
    let baseImage = sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 18, g: 18, b: 35, alpha: 1 } // Dark background matching the theme
      }
    });

    const composites = [];

    // Process each slot and prepare image overlays
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const photoPath = photoPaths[i] || photoPaths[photoPaths.length - 1]; // Fallback if fewer photos than slots

      if (!photoPath || !fs.existsSync(photoPath)) {
        console.warn(`Photo path missing or file not found: ${photoPath}`);
        continue;
      }

      // Resize and crop photo to fit the slot perfectly
      const processedPhotoBuffer = await sharp(photoPath)
        .resize({
          width: slot.width,
          height: slot.height,
          fit: 'cover',
          position: 'center'
        })
        .toBuffer();

      composites.push({
        input: processedPhotoBuffer,
        left: slot.x,
        top: slot.y
      });
    }

    // Composite the photos onto the base canvas
    let compositedBuffer = await baseImage.composite(composites).toBuffer();

    // If there is an overlay frame, lay it on top of the photos
    if (overlayImage) {
      let overlayBuffer;
      
      if (overlayImage.startsWith('data:image')) {
        // Handle Base64 Data URI
        const base64Data = overlayImage.replace(/^data:image\/\w+;base64,/, '');
        overlayBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Handle file path
        const absoluteOverlayPath = path.isAbsolute(overlayImage)
          ? overlayImage
          : path.join(__dirname, '..', overlayImage);

        if (fs.existsSync(absoluteOverlayPath)) {
          overlayBuffer = absoluteOverlayPath;
        }
      }

      if (overlayBuffer) {
        // Resize overlay to fit the layout width and height
        const resizedOverlay = await sharp(overlayBuffer)
          .resize(width, height)
          .toBuffer();

        compositedBuffer = await sharp(compositedBuffer)
          .composite([{ input: resizedOverlay, left: 0, top: 0 }])
          .toBuffer();
      }
    }

    // Save final output file
    await sharp(compositedBuffer)
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    console.log(`Successfully generated composite: ${path.basename(outputPath)}`);
    return outputPath;
  } catch (error) {
    console.error('Error during image compositing:', error);
    throw error;
  }
}

module.exports = {
  compositeImages
};
