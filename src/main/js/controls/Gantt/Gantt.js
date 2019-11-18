"use strict";
import d3 from "d3";
import Construct from "../../core/Construct";
import { getYAxisHeight } from "../../helpers/axis";
import constants from "../../helpers/constants";
import errors from "../../helpers/errors";
import { createLegend } from "../../helpers/legend";
import styles from "../../helpers/styles";
import utils from "../../helpers/utils";
import {
    contentLoadHandler,
    contentUnloadHandler
} from "../../helpers/constructUtils";
import GanttConfig, { processInput } from "./GanttConfig";
import {
    prepareLegendEventHandlers,
    renderLegendItems
} from "./helpers/actionHelpers";
import { createDateline } from "../../helpers/dateline";
import {
    attachEventHandlers,
    calculateAxesLabelSize,
    calculateAxesSize,
    createAxes,
    createContentContainer,
    createDefs,
    createGanttContent,
    createGrid,
    createTrack,
    detachEventHandlers,
    determineHeight,
    prepareLoadAtIndex,
    scaleGraph,
    updateAxesDomain,
    d3RemoveElement
} from "./helpers/creationHelpers";
import { translateGraph, translateLabelText } from "./helpers/translateHelpers";

/**
 * @typedef {object} Gantt
 * @typedef {object} GanttConfig
 */

const BASE_CANVAS_WIDTH_PADDING = constants.BASE_CANVAS_WIDTH_PADDING;

const LIVE_GRAPHS = [];
/**
 * Sets the canvas width
 *
 * @private
 * @param {HTMLElement} container - d3 HTML element object which forms the chart container
 * @param {object} config - config object derived from input JSON
 * @returns {undefined} - returns nothing
 */
const setCanvasWidth = (container, config) => {
    config.canvasWidth = parseInt(container.style("width"), 10);
};
/**
 * Sets the canvas width. Canvas rests within a container.
 * On resize, the canvas is subjected to resizing but its sibling: Legend isnt.
 *
 * @private
 * @param {object} config - config object derived from input JSON
 * @returns {undefined} - returns nothing
 */
const setCanvasHeight = (config) =>
    (config.canvasHeight =
        getYAxisHeight(config) +
        (config.padding.bottom * 2 + config.padding.top) * 2);
/**
 * Data point sets can be loaded using this function.
 * Load function validates, clones and stores the input onto a config object.
 *
 * @private
 * @throws {module:errors.THROW_MSG_NO_AXES_DATA_LOADED}
 * @param {object} inputJSON - Input JSON provided by the consumer
 * @returns {object} config object containing consumer data
 */
const loadInput = (inputJSON) =>
    new GanttConfig()
        .setInput(inputJSON)
        .validateInput()
        .clone()
        .getConfig();
/**
 * Executes the before init process checklist, needs to be called by parent control.
 *  Binds the chart id provided in the input JSON to graph container.
 *
 * @private
 * @param {Gantt} control - Gantt instance
 * @returns {Gantt} Gantt instance
 */
const beforeInit = (control) => {
    control.graphContainer = d3.select(control.config.bindTo);
    updateAxesDomain(control.config);
    control.config.height = determineHeight(control.config);
    return control;
};
/**
 * Initializes the necessary Gantt constructor objects
 *
 * @private
 * @param {Gantt} control - Gantt instance
 * @returns {Gantt} Gantt instance
 */
const initConfig = (control) => {
    control.graphContainer = null;
    control.config = {
        axis: {
            x: {},
            y: {}
        },
        shownTargets: {},
        actionLegend: [],
        dateline: [],
        pan: {}
    };
    control.axis = {};
    control.scale = {};
    control.svg = null;
    control.legendSVG = null;
    control.tracks = [];
    control.trackConfig = [];
    control.resizeHandler = null;
    return control;
};
/**
 * Executes the init process checklist, needs to be called by parent control.
 * Needs to be called post calling beforeInit
 *  Sets the canvas width within the graph container
 *  Determines the height for canvas
 *  Calculates Axes width and height
 *  Calculates Axes label width and height, positioning
 *  Creates and sets the d3 scale for the Graph
 *
 * @private
 * @param {Gantt} control - Gantt instance
 * @returns {Gantt} Gantt instance
 */
const init = (control) => {
    setCanvasWidth(control.graphContainer, control.config);
    calculateAxesSize(control.config);
    calculateAxesLabelSize(control.config);
    setCanvasHeight(control.config);
    scaleGraph(control.scale, control.config);
    return control;
};

/**
 * Gantt chart construct
 * * Axis - X
 * * X ticks
 * * Content that serves as Tracks (Rows). Tracks are Y axis. Y axis labels are clickable
 *
 * Lifecycle functions include:
 *  * BeforeInit
 *  * Init
 *  * Render
 *  * AfterInit
 *
 * @module Gantt
 * @class Gantt
 */
class Gantt extends Construct {
    /**
     * @class
     * @param {GanttConfig} input - Input JSON instance created using GanttConfig
     */
    constructor(input) {
        super();
        initConfig(this);
        this.generate(input);
    }

    /**
     * Draw function that is called by the parent control. This draws the x-axis, grid, legend and
     * trackLabels for the chart construct.
     *
     * @description Since we dont have the concept of z-index in visualization,
     * the order of rendering should be following:
     *  * SVG container
     *  * Grid
     *  * X-Axis
     *  * Y-Axis
     *  * Track Labels
     *  * Legend
     *  * Data [In our case we have load and unload]
     * @param {object} input - Input JSON
     * @returns {HTMLElement} d3 selection node of svg.
     */
    generate(input) {
        this.config = loadInput(input);
        processInput(input, this.config);
        beforeInit(this);
        init(this);
        LIVE_GRAPHS.push(this);
        const containerSVG = d3
            .select(this.config.bindTo)
            .append("div")
            .classed(styles.container, true);
        this.svg = containerSVG
            .insert("svg", ":first-child")
            .classed(styles.canvas, true)
            .attr("role", "img")
            .attr("height", this.config.canvasHeight)
            .attr(
                "width",
                this.config.padding.hasCustomPadding
                    ? this.config.canvasWidth
                    : this.config.canvasWidth - BASE_CANVAS_WIDTH_PADDING
            );
        createDefs(this.config, this.svg);
        createGrid(this.axis, this.scale, this.config, this.svg);
        createContentContainer(this.config, this.svg);
        createAxes(this.axis, this.scale, this.config, this.svg);
        createGanttContent(this.config, this.svg);
        if (utils.notEmpty(this.config.dateline)) {
            createDateline(this.scale, this.config, this.svg);
        }
        if (this.config.showActionLegend) {
            this.legendSVG = createLegend(
                this.config.bindLegendTo
                    ? d3.select(this.config.bindLegendTo)
                    : containerSVG
            );
            this.config.shownTargets = this.config.actionLegend.map(
                (legendItem) => legendItem.key
            );
            this.config.actionLegend.forEach((item) =>
                renderLegendItems(
                    this.config,
                    prepareLegendEventHandlers(
                        this,
                        this.config,
                        this.svg,
                        this.config.shownTargets
                    ),
                    item,
                    this.legendSVG
                )
            );
        }
        attachEventHandlers(this);
        return this.svg;
    }

    /**
     * Resizes the graph canvas. Uses the clipPath def.
     * It scales the graph on resize, and translates the graph elements:
     *  X-Axis
     *  Grid
     *  Track Labels
     *
     *  @returns {Gantt} - Gantt instance
     */
    resize() {
        if (this.graphContainer) {
            setCanvasWidth(this.graphContainer, this.config);
            scaleGraph(this.scale, this.config);
            translateGraph(this);
            this.trackConfig.forEach((control) => control.resize(this));
            translateLabelText(this.scale, this.config, this.svg);
            return this;
        }
    }

    /**
     * Loads the content onto the graph.
     * The content serves as a 1to1 relationship. For rendering
     * multiple data sets respective number of content needs to be provided.
     *
     * @param {object|Array} content - Gantt content to be loaded
     * @returns {Gantt} - Gantt instance
     */
    loadContent(content) {
        contentLoadHandler(content, (i) => {
            const index = prepareLoadAtIndex(
                this.scale,
                this.config,
                i,
                this.tracks.length
            );
            const track = createTrack(i);
            this.trackConfig.splice(index, 0, track);
            track.load(this);
            this.tracks.splice(index, 0, i.key);
        });
        updateAxesDomain(this.config);
        this.config.height = determineHeight(this.config);
        setCanvasHeight(this.config);
        this.resize();
        this.trackConfig.forEach((control) => control.redraw(this));
        return this;
    }

    /**
     * Unloads the content from the graph.
     * The content serves as a 1to1 relationship. For rendering
     * multiple data sets respective number of content needs to be provided.
     *
     * @param {object|Array} content - Gantt content to be removed
     * @returns {Gantt} - Gantt instance
     */
    unloadContent(content) {
        contentUnloadHandler(content, (i) => {
            const index = this.tracks.indexOf(i.key);
            if (index < 0) {
                throw new Error(errors.THROW_MSG_INVALID_OBJECT_PROVIDED);
            }
            this.trackConfig[index].unload(this);
            this.tracks.splice(index, 1);
            this.trackConfig.splice(index, 1);
        });
        updateAxesDomain(this.config);
        this.config.height = determineHeight(this.config);
        setCanvasHeight(this.config);
        this.resize();
        return this;
    }

    /**
     * Destroys the graph: Container and canvas.
     *
     * @returns {Gantt} - Gantt instance
     */
    destroy() {
        for (let i = LIVE_GRAPHS.length - 1; i >= 0; i--) {
            detachEventHandlers(LIVE_GRAPHS[i]);
            d3RemoveElement(LIVE_GRAPHS[i].graphContainer, `.${styles.canvas}`);
            d3RemoveElement(
                LIVE_GRAPHS[i].graphContainer,
                `.${styles.container}`
            );
            LIVE_GRAPHS.pop();
        }
        initConfig(this);
        return this;
    }
}

export default Gantt;
