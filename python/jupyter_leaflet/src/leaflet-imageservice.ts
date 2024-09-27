// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import L, { ImageServiceOptions, Map, Point, } from 'leaflet';


// @function setOpacityActual(el: HTMLElement, opacity: Number)
// Set the opacity of an element.
// `opacity` must be a number from `0` to `1`.
function setOpacityActual(el: HTMLElement, value: Number) {
  if ('opacity' in el.style) {
    el.style.opacity = value.toString();
  }
}


L.ImageService = L.Layer.extend({
  options: {
    url: '',
    f: 'image',
    format: 'jpgpng',
    pixelType: 'UNKNOWN',
    noData: [],
    noDataInterpretation: '',
    interpolation: '',
    compressionQuality: '',
    bandIds: [],
    time: [],
    renderingRule: {},
    mosaicRule: {},
    endpoint: '',
    attribution: '',
    crs: null,
    interactive: false,
    updateInterval: 200,
    opacity: 1,
  },

  initialize: function (options: ImageServiceOptions) {
    L.Util.setOptions(this, options);
  },

  updateUrl: function () {
    // update the url for the current bounds
    if (this.options.endpoint === 'Esri') {
      this._url = this.options.url + '/exportImage' + this._buildParams();
    } else {
      this._url = this.options.url;
    }
    this._bounds = this.toLatLngBounds(this._getBounds());
    this._topLeft = this._map.getPixelBounds().min;
    return this;
  },

  onAdd: function (map: Map) {
    this._map = map;
    this.updateUrl();
    if (!this._image) {
      this._initImage();

      if (this.options.opacity < 1) {
        this._updateOpacity();
      }

    }
    this._map.on('moveend', () => {
      L.Util.throttle(this.update(), this.options.updateInterval, this);
    });
    if (this.options.interactive) {
      L.DomUtil.addClass(this._image, 'leaflet-interactive');
      this.addInteractiveTarget(this._image);
    }
    this.getPane().appendChild(this._image);
    this._reset();
  },

  onRemove: function () {
    L.DomUtil.remove(this._image);
    if (this.options.interactive) {
      this.removeInteractiveTarget(this._image);
    }
  },

  // @method setOpacity(opacity: Number): this
  // Sets the opacity of the overlay.
  setOpacity: function (opacity: Number) {
    this.options.opacity = opacity;

    if (this._image) {
      this._updateOpacity();
    }
    return this;
  },

  //  setStyle: function (styleOpts) {
  //    if (styleOpts.opacity) {
  //      this.setOpacity(styleOpts.opacity);
  //    }
  //    return this;
  //  },


  bringToFront: function () {
    // bring layer to the top of all overlays
    if (this._map) {
      L.DomUtil.toFront(this._image);
    }
    return this;
  },

  bringToBack: function () {
    // bring layer to the bottom of all overlays
    if (this._map) {
      L.DomUtil.toBack(this._image);
    }
    return this;
  },

  setUrl: function (url: string) {
    // change the URL of the image
    if (this.options.endpoint === 'Esri') {
      this._url = url + '/exportImage' + this._buildParams();
    } else {
      this._url = url;
    }
    if (this._image) {
      this._image.src = url;
    }
    return this;
  },

  getEvents: function () {
    var events = {
      zoom: this._reset,
      viewreset: this._reset,
      zoomanim: false,
    };

    if (this._zoomAnimated) {
      events.zoomanim = this._animateZoom;
    }

    return events;
  },

  getBounds: function () {
    // get bounds
    return this._bounds;
  },

  toLatLngBounds: function (
    a: L.LatLngBounds | L.LatLngExpression,
    b: L.LatLngExpression
  ) {
    // convert bounds to LatLngBounds object
    if (a instanceof L.LatLngBounds) {
      return a;
    }
    return new L.LatLngBounds(a, b);
  },

  getElement: function () {
    // get image element
    return this._image;
  },

  getCenter: function () {
    // get map center
    return this._bounds.getCenter();
  },

  _getBBox: function () {
    // get the bounding box of the current map formatted for exportImage
    const pixelbounds = this._map.getPixelBounds();
    const sw = this._map.unproject(pixelbounds.getBottomLeft());
    const ne = this._map.unproject(pixelbounds.getTopRight());
    return [
      this._map.options.crs.project(ne).x,
      this._map.options.crs.project(ne).y,
      this._map.options.crs.project(sw).x,
      this._map.options.crs.project(sw).y,
    ];
  },

  _getBounds: function () {
    // get the bounds of the current map
    return [
      [this._map.getBounds().getSouth(), this._map.getBounds().getWest()],
      [this._map.getBounds().getNorth(), this._map.getBounds().getEast()],
    ];
  },

  _getSize: function () {
    // get the size of the current map
    const size = this._map.getSize();
    return [size.x, size.y];
  },

  _getEPSG: function () {
    // get the EPSG code (numeric) of the current map
    const epsg = this.options.crs.code;
    const spatial_reference = parseInt(epsg.split(':')[1], 10);
    return spatial_reference;
  },

  _getTime: function () {
    // get start and end times and convert to seconds since epoch
    const startTime = new Date(this.options.time[0]).getTime().valueOf();
    const endTime = new Date(this.options.time[1]).getTime().valueOf();
    return [startTime, endTime];
  },

  _buildParams: function () {
    // parameters for image server query
    const params: Record<string, any> = {
      bbox: this._getBBox().join(','),
      size: this._getSize().join(','),
      bboxSR: this._getEPSG(),
      imageSR: this._getEPSG(),
      f: this.options.f,
    };
    // add string parameters
    if (this.options.format) {
      params['format'] = this.options.format;
    }
    if (this.options.pixelType) {
      params['pixelType'] = this.options.pixelType;
    }
    if (this.options.noDataInterpretation) {
      params['noDataInterpretation'] = this.options.noDataInterpretation;
    }
    if (this.options.interpolation) {
      params['interpolation'] = this.options.interpolation;
    }
    if (this.options.compressionQuality) {
      params['compressionQuality'] = this.options.compressionQuality;
    }
    // merge list parameters
    if (this.options.noData.length) {
      params['noData'] = this.options.noData.join(',');
    }
    if (this.options.bandIds.length) {
      params['bandIds'] = this.options.bandIds.join(',');
    }
    if (this.options.time.length) {
      params['time'] = this._getTime().join(',');
    }
    // convert dictionary parameters to JSON
    if (Object.keys(this.options.renderingRule).length) {
      params['renderingRule'] = JSON.stringify(this.options.renderingRule);
    }
    if (Object.keys(this.options.mosaicRule).length) {
      params['mosaicRule'] = JSON.stringify(this.options.mosaicRule);
    }
    // return the formatted query string
    return L.Util.getParamString(params);
  },

  _initImage: function () {
    const wasElementSupplied = this._url.tagName === 'IMG';
    const img = (this._image = L.DomUtil.create('img'));
    L.DomUtil.addClass(img, 'leaflet-image-layer');

    if (this._zoomAnimated) { L.DomUtil.addClass(img, 'leaflet-zoom-animated'); }
    if (this.options.className) { L.DomUtil.addClass(img, this.options.className); }


    img.onselectstart = L.Util.falseFn;
    img.onmousemove = L.Util.falseFn;
    img.onload = L.Util.bind(this.fire, this, 'load');
    if (wasElementSupplied) {
      this._url = img.src;
      return;
    }
    img.src = this._url;
  },

  _animateZoom: function (e: { zoom: any; center: any; }) {
    var scale = this._map.getZoomScale(e.zoom),
      offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;

    L.DomUtil.setTransform(this._image, offset, scale);
  },


  _reset: function () {
    var image = this._image,
      bounds = new L.Bounds(
        this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
        this._map.latLngToLayerPoint(this._bounds.getSouthEast())),
      size = bounds.getSize();

    L.DomUtil.setPosition(image, bounds.min ?? new Point(0, 0));

    image.style.width = size.x + 'px';
    image.style.height = size.y + 'px';

    this._updateOpacity();
  },

  _updateOpacity: function () {
    setOpacityActual(this._image, this.options.opacity);
  },

  update: function () {
    if (!this._map) {
      return;
    }
    // don't update if currently panning
    if (this._map._panTransition && this._map._panTransition._inProgress) {
      return;
    }
    // update the url for the current bounds
    this.updateUrl();
    // update image source
    if (this._image && this._map) {
      this._image.src = this._url;
      // delay reset until the new image is loaded
      this._image.onload = () => {
        this._reset();
      };
    }
  },
});

L.imageService = function (options) {
  return new L.ImageService(options);
};
