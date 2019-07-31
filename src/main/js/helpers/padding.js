"use strict";
import d3 from "d3";
import { getYAxisHeight } from "./axis";

/**
 * @module padding
 * @alias module:padding
 */

/**
 * Calculates the amount of width available for the graph without the padding
 * in the container. This is so that the consumer can position the graph in the page
 * however they want.
 *
 * @private
 * @param {d3.Selection} d3Element - d3 element of the graph container provided by consumer
 * @returns {number} Total width of the graph
 */
const getElementContentWidth = (d3Element) => {
    const htmlElement = d3Element.node();
    const styles = window.getComputedStyle(htmlElement);
    const padding =
        parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    return htmlElement.clientWidth - padding;
};

/**
 * Sets the canvas width
 *
 * @private
 * @param {d3.selection} container - d3 HTML element object which forms the chart container
 * @param {object} config - config object derived from input JSON
 * @returns {undefined} - returns nothing
 */
const setCanvasWidth = (container, config) => {
    config.canvasWidth = getElementContentWidth(container);
};

/**
 * Sets the canvas width. Canvas rests within a container.
 * On resize, the canvas is subjected to resizing but its sibling: Legend isnt.
 *
 * @private
 * @param {object} config - config object derived from input JSON
 * @returns {undefined} - returns nothing
 */
const setCanvasHeight = (config) => {
    config.canvasHeight =
        getYAxisHeight(config) +
        (config.padding.bottom + config.padding.top) * 2;
};

/**
 * @enum {Function}
 */
export { setCanvasWidth, setCanvasHeight };
