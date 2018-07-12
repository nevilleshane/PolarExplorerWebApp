function MapClient(view) { 
  //global URLs
  gmrtUrl = "https://www.gmrt.org:443/services/PointServer";
  gmrtMapUrl = "https://www.gmrt.org/services/mapserver/";
  placeNamesUrl = "http://app.earth-observer.org/data/overlays/WorldWFS";

  //set up projections
  //SP
  proj4.defs('EPSG:3031', '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
  //NP
  proj4.defs('EPSG:32661', '+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
  proj4.defs('EPSG:3995', '+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');

  sp_proj = ol.proj.get('EPSG:3031');
  sp_proj.setWorldExtent([-180.0000, -90.0000, 180.0000, -60.0000]);
  sp_proj.setExtent([-8200000, -8200000, 8200000, 8200000]);
  np_proj = ol.proj.get('EPSG:3995');
  np_proj.setWorldExtent([-180.0000, 60.0000, 180.0000, 90.0000]);
  np_proj.setExtent([-8200000, -8200000, 8200000, 8200000]);
  merc_proj = ol.proj.get('EPSG:3857');

  //parameters for different GMRT projections
  gmrt_params = {
    "merc": {"url_ext": "wms_merc?", "projection": merc_proj, "layer": "topo", "zoom": 2},
    "sp": {"url_ext": "wms_SP?", "projection": sp_proj, "layer": "GMRT_SP", "zoom": 2},
    "np": {"url_ext": "wms_NP?", "projection": np_proj, "layer": "GMRT_NP", "zoom": 2},
  };

  //set up the map
  var map = new ol.Map({target: view});
  this.map = map;

  //set initial parameters to Mercator projection
  var params = gmrt_params.merc;

  //set the map view
  map.setView(new ol.View({
    center: [0, 0],
    zoom: params.zoom,
    minZoom: 1,
    projection: params.projection
  }));

  //load up the GMRT base layer
  gmrtLayer = new ol.layer.Tile({
    type: 'base',
    title: "GMRT Synthesis",
    source: new ol.source.TileWMS({
        url: gmrtMapUrl + params.url_ext,
        crossOrigin: 'anonymous',
        wrapX: true,
        params: {
          layers: params.layer,
        }
    })
  });
  map.addLayer(gmrtLayer);

  //add the scale line
  var scaleline = new ol.control.ScaleLine({target:"scaleline"});
  map.addControl(scaleline);

  return map;
}

$(document).ready(function() {
  //initialize the main map
  map = new MapClient('map');
  
  //add a hidden map that only contains the top layer
  //this is what will be queried when clicking on the map
  map2 = new MapClient('hidden_map');

  /*
    handle the start of a map move/zoom
  */
  map.on('movestart', function(evt) {
    $("#elev").text("");
    //hide the hidden map whilst moving as it so the user doesn't see it
    $("#hidden_map").hide();
  });

  /*
    handle the end of a map move/zoom
  */
  map.on('moveend', function(evt) {
    //make sure hidden map stays aligned with visible map
    map2.getView().setZoom(map.getView().getZoom());
    map2.getView().setCenter(map.getView().getCenter());
    $("#hidden_map").show();
    //console.log("zoom level: " + map.getView().getZoom() + "("+Math.pow(2,map.getView().getZoom()-1)+") " + map.getView().getResolution());
  });

  /*
    Use the mouse position to display lat/lon
  */
  var mousePosition = new ol.control.MousePosition({
      coordinateFormat: ol.coordinate.createStringXY(2),
      projection: 'EPSG:4326',
      target: document.getElementById('mouseposition'),
      undefinedHTML: '&nbsp;'
  });
  map.addControl(mousePosition);

  // set up the geolocation api to track our position
  geolocation = new ol.Geolocation({
    projection: map.getView().getProjection()
  });

  // set the location feature as a blue circle 
  var positionFeature = new ol.Feature();
  positionFeature.setStyle(
    new ol.style.Style({
    image: new ol.style.Circle({
      radius: 6,
      fill: new ol.style.Fill({
        color: '#3399CC'
      }),
      stroke: new ol.style.Stroke({
        color: '#fff',
        width: 2
      })
    })
  }));

  //get current location and set the coordinates of the location feature
  geolocation.on('change:position', function() {
    var coords = geolocation.getPosition();
    //just use coords to 2dp, ie around 1 mile range
    coords = [coords[0].toFixed(2), coords[1].toFixed(2)];
    positionFeature.setGeometry(coords ?
      new ol.geom.Point(coords) : null);
  });

  //create a geolocation layer
  geolocationLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [positionFeature]
    })
  });
});


/*
  Display a tile_512 (local) layer
*/
function displayTile512(overlay, removeOldLayers, sequence) {
  console.log(overlay);

  var delta = parseInt(overlay.tileDelta)/180;

  var projExtent = ol.proj.get('EPSG:4326').getExtent();
  var startResolution = ol.extent.getWidth(projExtent) / overlay.tileSize * delta;
  var resolutions = new Array(overlay.numLevels+1);
  for (var i = 0, ii = resolutions.length; i < ii; ++i) {
    resolutions[i] = startResolution / Math.pow(2, i);
  }
 
  tileGrid = new ol.tilegrid.TileGrid({
    minZoom: 1,
    maxZoom: overlay.numLevels,
    extent: projExtent,
    resolutions: resolutions,
    tileSize: [overlay.tileSize, overlay.tileSize]
  });

  function tileUrlFunction(tileCoord) {
    var new_z = tileCoord[0]-1;
    var url = urlTemplate.replace('{z}', new_z)
        .replace('{x}', tileCoord[1].toString())
        .replace(/{y}/g, (Math.pow(2, new_z)/delta + tileCoord[2]).toString());
    return url;
  };

  var urlTemplate = overlay.source + '/{z}/{y}/{y}_{x}.png' ; 
  var eoLayer = new ol.layer.Tile({
    source: new ol.source.TileImage({
      minZoom: 1,
      maxZoom: overlay.numLevels,
      projection: 'EPSG:4326',
      tileSize: overlay.tileSize,
      //tilePixelRatio:2,
      crossOrigin: 'anonymous',
      tileGrid: tileGrid,
      tileUrlFunction: tileUrlFunction,
      wrapX: true,
      transition:0
    }),
    title: sequence ? "Sequence" : ""
  });
  displayLayer(eoLayer, overlay, removeOldLayers);
}

/*
  display a WMS_512 layer
*/
function displayWMS512(overlay, removeOldLayers, sequence) {
  console.log(overlay);
  var url = overlay.source.replace("http://neowms", "https://neo");
  var wmsLayer = new ol.layer.Tile({
    type: 'base',
    title: overlay.title,
    source: new ol.source.TileWMS({
      url: url,
      crossOrigin: 'anonymous',
      projection: getProjectionFromUrl(url),
      params: getParamsFromUrl(url)
    }),
    title: sequence ? "Sequence" : ""
  });
  displayLayer(wmsLayer, overlay, removeOldLayers);
}

/*
  get the projection from the WMS URL
*/
function getProjectionFromUrl(url) {
  return getParamFromUrl(url, "SRS");
}

/*
  get parameter values from WMS URL
*/
function getParamsFromUrl(url) {
  var params={
    LAYERS: getParamFromUrl(url, "layers"),
    STYLES: getParamFromUrl(url, "styles"),
    VERSION: getParamFromUrl(url, "version"),
    WIDTH: getParamFromUrl(url, "width"),
    HEIGHT: getParamFromUrl(url, "height"),
    BBOX: getParamFromUrl(url, "bbox"),
    CRS: getParamFromUrl(url, "crs"),
    SRS: getParamFromUrl(url, "srs")
  };
  return params;
}

/*
  extract a parameter value from a WMS URL
*/
function getParamFromUrl(url, param) {
  url = url.toUpperCase();
  param = param.toUpperCase();
  if (url.indexOf(param) > 0) {
    var value = url.split(param+"=")[1];
    value = value.split("&")[0];
    return value;
  }
  return null;
}

/*
  merge two javascript objects - used to copy parameters from a multilayer object 
  to it's child layers
*/
function mergeObjects(obj1,obj2){
    var obj3 = {'parent_type': obj1.type};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

/*
  display an Overlay_sequence
*/
function displayOverlaySequence(overlay, removeOldLayers) {
  console.log(overlay);
  var type = overlay.overlayType;
  console.log(type);

  //get the overlay sequence
  $.ajax({
    type: "GET",
    url: overlay.sequenceSource,
    crossOrigin: true,
    success: function(response) {
      var lines = response.split("\n");
      sequences = [];
      for (var i in lines) {
        var line = lines[i].split("\t");
        if (line[0] === "") continue;
        var seq = {"label": line[0], "source": line[1]};
        //combine the sequence object with the overlay object
        //so that we retain all information
        sequences.push(mergeObjects(seq, overlay));
      }
      seq_num = 0;
      $("#sequence_left").addClass("disabled");
      $("#sequence_level").text(sequences[0].label);
      if (sequences.length == 1) 
        $("#sequence_right").addClass("disabled");
      else
        $("#sequence_right").removeClass("disabled");
      $("#sequence").show();
      displaySequenceLayer(sequences[0], type, true);
    }
  });

  // set the sequence left and right buttons to move through the sequences
  $("#sequence_left").unbind('click').click(function() {
    if ($("#sequence_left").hasClass("disabled")) return;
    seq_num--;
    $("#sequence_level").text(sequences[seq_num].label);
    $("#sequence_right").removeClass("disabled");
    if (seq_num === 0) $("#sequence_left").addClass("disabled");
    displaySequenceLayer(sequences[seq_num], type, false); 
  });

  $("#sequence_right").unbind('click').click(function() {
    if ($("#sequence_right").hasClass("disabled")) return;
    seq_num++;
    $("#sequence_level").text(sequences[seq_num].label);
    $("#sequence_left").removeClass("disabled");
    if (seq_num === sequences.length - 1) $("#sequence_right").addClass("disabled");
    displaySequenceLayer(sequences[seq_num], type, false);
  });

  /*
    direct the layer to the appropriate display function
  */
  function displaySequenceLayer(layer, type, removeOldLayers) {
    var sequence = true;
    //remove any existing sequence layers
    //removeLayerByName("Sequence");
    switch(type) {
      case "arcgis_tile_256":
        displayArcGIS(layer, removeOldLayers, sequence);
        break;
      case "tile_512":
        displayTile512(layer, removeOldLayers, sequence);
        break;
      case "wms_512":
        displayWMS512(layer, removeOldLayers, sequence);
        break;
      case "NOAAtile_256":
        displayNOAA(layer, removeOldLayers, sequence);
        break;
      case "table":
        display(layer, removeOldLayers, sequence);
        break;
      case "overlay_sequence":
        displayOverlaySequence(layer, removeOldLayers);
        break;
      case "xb_map":
        displayXBMap(layer, removeOldLayers, sequence);
        break;
      default:
        console.log("Unknown Sequence Layer Type: " + type);
    }
  }
}

/*
  display NOAA layer
*/
function displayNOAA(overlay, removeOldLayers, sequence) {
  console.log(overlay);

  //since we can't access the requestSourcePath directly to get the latest source path
  //due to Cross Origin restraints, a python script is run daily using cron that will
  //fetch those paths and save them in the noaaSourcePaths.json file. 
  if (overlay.requestSourcePath && overlay.source) {

    //First need to work out the product name to get the latest source path.
    var split = overlay.source.split("/");
    imageName = split[6];
    parts = imageName.split(".");
    product = parts[0] + "." + parts[1]

    $.ajax({
      url: "noaaSourcePaths.json",
      dataType: "json",
    }).done(function(data) { 
        tileUrl = data[product];
        getLayer(tileUrl);
    }).fail(function(err) {
      console.log("ERROR");
      console.log(err);
    });
  }

  //for sequences, use the source path sent to the function
  if (overlay.sequenceSource) {
    getLayer(overlay.source);
  }

  function getUrlAndImageName(tileUrl) {
    var split = tileUrl.split("/");
    var imageName = split[6];
    var split2 = imageName.split(".");
    var productName = split2[0] + "_" + split2[1]
    // for, e.g. salinity layer:
    if (split2[3] != "color") {
      productName += "_" + split2[3] + "m";
    }
    url = "https://gis.nnvl.noaa.gov/arcgis/rest/services/" + split[5] + "/" + productName + "/ImageServer/";
    return {url: url, imageName: imageName};
  }
  
  function getLayer(tileUrl) {
    var urlAndImageName = getUrlAndImageName(tileUrl);
    console.log(urlAndImageName);
    var arcgisLayer = new ol.layer.Tile({
      source: new ol.source.TileArcGISRest({
        url: urlAndImageName.url,
        crossOrigin: "anonymous",
        wrapX: true,
        params: {
          mosaicRule: "{where:\"name = '" + urlAndImageName.imageName + "'\"}"
        }
      }),
      title: sequence ? "Sequence" : ""
    })
    displayLayer(arcgisLayer, overlay, removeOldLayers);
  }
}


/*
  display ArcGIS layer
*/
function displayArcGIS(overlay, removeOldLayers, sequence) {
  console.log(overlay);
  var arcgisLayer;
  if (overlay.source.indexOf("tiles2.arcgis.com") > -1) {
    //some arcgis layers need to be read in as XYZ sources
    arcgisLayer = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: overlay.source+"{z}/{y}/{x}",
        crossOrigin: "anonymous"
      }),
      title: sequence ? "Sequence" : ""
    });
  } else {
    arcgisLayer = new ol.layer.Tile({
      source: new ol.source.TileArcGISRest({
        url: overlay.source.replace("tile/", "").replace("http:", "https:").replace("www.coast", "maps1.coast"),
        crossOrigin: 'anonymous',
        wrapX: true
      }),
      title: sequence ? "Sequence" : ""
    });
  }
  displayLayer(arcgisLayer, overlay, removeOldLayers);
}


/*
  display xb_map (local polar projected layers)
*/
function displayXBMap(overlay, removeOldLayers, sequence) {
  console.log(overlay);
  //switch projection
  var proj = overlay.mapProjection;
  switchProjection(proj);

  //calculate the resolutions for each zoom level
  var projExtent = map.getView().getProjection().getExtent();
  var startResolution = ol.extent.getWidth(projExtent) / 320;
  var resolutions = new Array(overlay.numLevels+1);
  for (var i = 0, ii = resolutions.length; i < ii; ++i) {
    resolutions[i] = startResolution / Math.pow(2, i);
  }

  //set up a tile grid
  tileGrid = new ol.tilegrid.TileGrid({
    minZoom: 1,
    maxZoom: overlay.numLevels,
    extent: projExtent,
    resolutions: resolutions,
    tileSize: [320,320]
  });

  var source_url = overlay.source.replace("www.earth-observer", "app.earth-observer");
  //make sure there is not a / and the end of the source URL
  if (source_url.slice(-1) == "/") {
    source_url = source_url.slice(0, -1);
  }
  var xbMapUrlTemplate =  source_url + '/i_{res}/{name}.png'; 
  xbMapLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      projection: map.getView().getProjection(),
      tileSize: 320,
      minZoom:1,
      maxZoom:overlay.numLevels,
      tileGrid: tileGrid,
      crossOrigin: 'anonymous',
      tileUrlFunction: function(tileCoord) {
        var url = xbMapUrlTemplate.replace('{res}', (Math.pow(2,tileCoord[0]-1)).toString())
            .replace('{name}', getNameWithTileX(tileCoord));
        return(url);
      },
      wrapX: false
    }),
    title: sequence ? "Sequence" : ""
  });

  //use the tileCoords to geerate the URL name
  function getNameWithTileX(tileCoord) {
    var x = tileCoord[1];
    var y = tileCoord[2];
    var res = Math.pow(2,tileCoord[0]-1);

    var first;
    var second;
    if (res - x > 0)
      first = "W" + (res-x).toString();
    else
      first = "E" + (x-res).toString();

    if (res + y >= 0 )
      second = "S" + (res + 1 + y).toString();
    else
      second = "N" + (-1 * (res + 1 + y)).toString();

    var name = first + second + "_320";
    return name;
  }

  displayLayer(xbMapLayer, overlay, removeOldLayers);
}

/* 
  switch to a different projection
*/
function switchProjection(proj) {
  var params;
  switch(proj) {
    case 0:
      params = gmrt_params.merc;
      break;
    case 1:
      params = gmrt_params.sp;
      break;
    case 2:
      params = gmrt_params.np;
      break;
  }
  map.getView().setZoom(params.zoom);
  if (map.getView().getProjection() == params.projection) return;
  map.removeLayer(gmrtLayer);
  console.log(params);
  map.setView(new ol.View({
    center: [0, 0],
    zoom: params.zoom,
    minZoom: 1,
    projection: params.projection
  }));

  gmrtLayer = new ol.layer.Tile({
    type: 'base',
    title: "GMRT Synthesis",
    source: new ol.source.TileWMS({
        url: gmrtMapUrl + params.url_ext,
        params: {
        layers: params.layer
        }
    })
  });
  map.addLayer(gmrtLayer);

  //update projection of hidden map too
  map2.setView(map.getView());

}

/*
  handle multilayer displays, directing each layer to the correct display function
*/
function displayMultiLayers(overlay) {
  console.log(overlay);
  var removeOldLayers = true;
  for (var i in overlay.layers) {
    var layer = mergeObjects(overlay, overlay.layers[i]);
    //don't remove the lowest layer
    if (i > 0) removeOldLayers = false; 
    switch(layer.type) {
      case "arcgis_tile_256":
        displayArcGIS(layer, removeOldLayers);
        break;
      case "tile_512":
        displayTile512(layer, removeOldLayers);
        break;
      case "wms_512":
        displayWMS512(layer, removeOldLayers);
        break;
      case "NOAAtile_256":
        displayNOAA(layer, removeOldLayers);
        break;
      case "table":
        displayTable(layer, removeOldLayers);
        break;
      case "overlay_sequence":
        displayOverlaySequence(layer, removeOldLayers);
        break;
      case "xb_map":
        displayXBMap(layer, removeOldLayers);
        break;
      default:
        console.log("Unknown Overlay Type: " + layer.type);
    }

  }
}

/*
  display a table layer
*/
function displayTable(overlay, removeOldLayers) {
  console.log(overlay);
  var sizeCol, sizeRange, sizeColString, colorCol, colorColString;
  if (overlay.scaleSizeColumn) sizeCol = overlay.scaleSizeColumn-1;
  if (overlay.scaleSizeRange) {
    sizeRange = overlay.scaleSizeRange.split(",");
    sizeRange = [parseInt(sizeRange[0]), parseInt(sizeRange[1])];
  }
  if (overlay.symbolColorColumn) colorCol = overlay.symbolColorColumn-1;
  $.get({
    url: overlay.source.replace("http://earthquake.usgs", "https://earthquake.usgs"),
    dataType: "text",
    crossOrigin: true,
    success: function(response) {
      var csvString = response;
      if (overlay.separator === "tsv") {
        //if tab-separated, convert to comma-separated (replace commas with pipes first)
        csvString = csvString.replace(/,/g, "|").replace(/\t/g, ",");
      }

      // get symbol size and color column names
      var columns = csvString.split(/\r?\n|\r/)[0].split(',');
      if (sizeCol) sizeColString = columns[sizeCol];
      if (colorCol) colorColString = columns[colorCol];
      csv2geojson.csv2geojson(csvString, function(err, data) {
        console.log(data);
        console.log(err);

        //make sure all other tables are cleared first
        removeAllTables();

        tableLayer = new ol.layer.Vector({
          visible:true,
          source: new ol.source.Vector({
            features: (new ol.format.GeoJSON()).readFeatures(data, {featureProjection:'EPSG:3857'}),
          }),
           style: styleFunction 
        });
        //set up Object for table popup display
        properties = [];
        units = overlay.listUnits.replace(/NULL/g, "").split(",");
        var list_order = overlay.listOrder.split(",");
        for (var i in list_order) {
          var ind = list_order[i] - 1;
          properties.push(columns[ind]);
        }
        var url;
        var url_property;
        if (overlay.clickableLink) {
          var link = overlay.clickableLink.split(","); 
          if (link.length > 1) {
            url = link[0];
            url_property = columns[link[1]-1];
          } else if (link.length === 1) {
            if (link.indexOf("http") > -1) url = link[0];
            else url_property = columns[link[0]-1];
          }
        }
        var image_url;
        var image_url_property;
        if (overlay.imageLink) {
          var image_link = overlay.imageLink.split(",");
          if (image_link.length > 1) {
            image_url = image_link[0];
            image_url_property = columns[image_link[1]-1];
          } else if (image_link.length === 1) {
            if (image_link.indexOf("http") > -1) image_url = image_link[0];
            else image_url_property = columns[image_link[0]-1];
          }
        }

        tablePopupObj = {"properties": properties, 
                         "units": units, 
                         "base_url": url,
                         "url_property": url_property,
                         "image_base_url": image_url,
                         "image_url_property": image_url_property};
        console.log(tablePopupObj);

        displayLayer(tableLayer, overlay, removeOldLayers);

      });
    }
  });

  // set the style function for the plotted points
  var styleFunction = function(feature) {
    var rgb = [0,0,0];
    if (colorColString && feature.get(colorColString)) {
      rgb = feature.get(colorColString).split('|');
    }
    var radius = 5;
    if (sizeColString && feature.get(sizeColString)) {
      radius = feature.get(sizeColString);
      // if (radius < sizeRange[0]) radius = sizeRange[0];
      // if (radius > sizeRange[1]) radius = sizeRange[1];
    }
    var retStyle = new ol.style.Style({
        image: new ol.style.Circle({
          radius: radius,
          stroke: new ol.style.Stroke({
            color: 'rgba(255, 255, 255, 1)',
            width: 1
          }),
          fill: new ol.style.Fill({
            color: 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] +' , 1)'
          })
        })
      });
    return retStyle;
  };
}

/*
  convert a decimal color value to RGB
*/
function decimalToRGB(c) {
  var r = Math.floor(c / (256*256));
  var g = Math.floor(c / 256) % 256;
  var b = c % 256;
  return "rgb("+r+","+g+","+b+")";
}

/*
  Display place names from a JSON file created using the WFS XML pages
  This is simpler than handling gridded tiles
*/
function displayPlaceNameFeatures() {
  var formatGeoJSON = new ol.format.GeoJSON();

  sourceVector = new ol.source.Vector({
    loader: function() {
      for (var j in placeNameFeatures) {
        var placeNameFeature = placeNameFeatures[j];
        var feature = formatGeoJSON.readFeature(placeNameFeature.feature);
        feature.getGeometry().transform(merc_proj, map.getView().getProjection());
        feature.setStyle(textStyleFunction);
        feature.minZoom = placeNameFeature.minZoom;
        feature.maxZoom = placeNameFeature.maxZoom;
        feature.fontColor = decimalToRGB(placeNameFeature.fontColor);
        feature.fontSize = placeNameFeature.fontSize;
        feature.fontName = placeNameFeature.fontName;
        feature.name = placeNameFeature.name;
        sourceVector.addFeature(feature);
      }
    }
  });
 
  function textStyleFunction() {
    return [
      new ol.style.Style({
          fill: new ol.style.Fill({
          color: 'rgba(255,255,255,0.4)'
        }),
        stroke: new ol.style.Stroke({
          color: '#3399CC',
          width: 1.25
        }),
        text: new ol.style.Text({
          font: this.fontSize + 'px' + this.fontName,
          fill: new ol.style.Fill({ color: this.fontColor }),
          stroke: new ol.style.Stroke({
            color: "#000", width: 2
          }),
          // get the text from the feature - `this` is ol.Feature
          // and show only under certain resolution
          text: (Math.pow(2,map.getView().getZoom()-1) >= this.minZoom && Math.pow(2,map.getView().getZoom()-1) <= this.maxZoom) ? this.name : ""
          //text: this.name
        })
      })
    ];
  }
  
  placeNamesLayer = new ol.layer.Vector({
    title: "placeNamesLayer",
    source: sourceVector,
    zIndex:10
  });
  map.addLayer(placeNamesLayer);
}

/* 
  This code loads up all the WFS XML files in one go and extracts the features, rather than using gridded tiles.  
  It is too slow to use on the actual webapp.
  Instead, it can be used to create json strings that can be copied from the console and 
  saved in placeNameFeatures.json.  It is best to run in small batches, rather than all at once as too many
  ajax processes can overwhelm the network.  Use the `if (...) continue` lines to filter the feature sets.
*/
function displayPlaceNames() {
  var url_template = "http://app.earth-observer.org/data/overlays/WorldWFS/PlaceNames/{type}/{y}/{y}_{x}.xml.gz"
  formatWFS = new ol.format.WFS({gmlFormat: new ol.format.GML2()});
  var writer = new ol.format.GeoJSON();
  var allFeatures = [];

  sourceVector = new ol.source.Vector({
    loader: function() {
      for (var j in Object.keys(placeNames)) {
        var deltas = Object.keys(placeNames)[j]
        var thisSet = placeNames[deltas];
        var deltaY = parseInt(deltas.split(",")[0]);
        var deltaX = parseInt(deltas.split(",")[1]);
        var maxY = 180/deltaY;
        var maxX = 360/deltaX;
        if (deltaY != 5) continue;
        for (var k in thisSet) {
          var thisPNLayer = thisSet[k];
          if (thisPNLayer.type == "topp:countries") continue;
          if (thisPNLayer.type != "10") continue;
          for (var y=0; y<maxY; y++){
            for (var x=0; x<maxX; x++){

              var url = url_template.replace("{type}", thisPNLayer.type).replace(/{y}/g, y).replace("{x}", x);
              //console.log(url);
              var minZoom = thisPNLayer.minZoom ? parseInt(thisPNLayer.minZoom) : 0;
              var maxZoom = thisPNLayer.maxZoom ? parseInt(thisPNLayer.maxZoom) : 999;
              $.ajax({
                  url: url,
                  type: 'GET',
                  crossOrigin: true,
                  minZoom: minZoom,
                  maxZoom: maxZoom,
                  fontColor: thisPNLayer.fontColor,
                  fontName: thisPNLayer.fontName,
                  fontSize: thisPNLayer.fontSize
              }).done(function(response) {                
                  var features = formatWFS.readFeatures(response);
                  // lat and lon are the wrong way round in the WFS, so need to flip
                  for (var i in features) {
                    var feature = features[i];
                    //console.log(feature);
                    var name = "";
                    if (feature.get("full_name_nd")) name = feature.get("full_name_nd");
                    if (feature.get("FullName")) name = feature.get("FullName");
                    var lat, lon;
                    if (feature.get("latitude")) {
                      lat = parseFloat(feature.get("latitude"));
                      lon = parseFloat(feature.get("longitude"));
                    } else if (feature.getGeometry()) {
                      lat = feature.getGeometry().getCoordinates()[0];
                      lon = feature.getGeometry().getCoordinates()[1];
                    }

                    // convert latlon to current projection
                    var newCoord = ol.proj.transform([lon, lat], 'EPSG:4326', map.getView().getProjection());
                    feature.setGeometry(new ol.geom.Point([newCoord[0], newCoord[1]]));
                    feature.setStyle(textStyleFunction);
                    feature.minZoom = this.minZoom;
                    feature.maxZoom = this.maxZoom;
                    feature.fontColor = decimalToRGB(this.fontColor);
                    feature.fontSize = this.fontSize;
                    feature.fontName = this.fontName;
                    feature.name = name;
                    var record = {feature: writer.writeFeature(feature), 
                      minZoom: this.minZoom, 
                      maxZoom: this.maxZoom,
                      name: name,
                      fontColor: this.fontColor,
                      fontSize: this.fontSize,
                      fontName: this.fontName
                    }
                    allFeatures.push(record);
                  }
                  sourceVector.addFeatures(features);
              });
            }
          }
        }
      }
    }
  });
 
  function textStyleFunction() {
    return [
      new ol.style.Style({
          fill: new ol.style.Fill({
          color: 'rgba(255,255,255,0.4)'
        }),
        stroke: new ol.style.Stroke({
          color: '#3399CC',
          width: 1.25
        }),
        text: new ol.style.Text({
          font: this.fontSize + 'px' + this.fontName,
          fill: new ol.style.Fill({ color: this.fontColor }),
          stroke: new ol.style.Stroke({
            color: "#000", width: 2
          }),
          // get the text from the feature - `this` is ol.Feature
          // and show only under certain resolution
          text: (Math.pow(2,map.getView().getZoom()-1) >= this.minZoom && Math.pow(2,map.getView().getZoom()-1) <= this.maxZoom) ? this.name : ""
          //text: this.name
        })
      })
    ];
  }
        
  setTimeout (function() {
    console.log(JSON.stringify(allFeatures));
  },20000)                

  var placeNamesLayer = new ol.layer.Vector({
    source: sourceVector
  });
  map.addLayer(placeNamesLayer);
}


/*
  Experimental code used to try and display place names using vector tiles.
  Couldn't get it to work, but may return to it later.
*/
function displayPNLayer (layer) {
  formatWFS = new ol.format.WFS({gmlFormat: new ol.format.GML2()});
  var zoom = map.getView().getZoom();
  var minZoom = layer.minZoom ? parseInt(layer.minZoom) : 0;
  var maxZoom = layer.maxZoom ? parseInt(layer.maxZoom) : 999;

  //remove pre-existing version of layer
  // if (zoom < minZoom || zoom > maxZoom) {
  //   //removeLayerByName(layer.type);
  //   return;
  // }
  // sourceVector = new ol.source.Vector({
  //   loader: function() {

  //     $.ajax({
  //         url: 'http://app.earth-observer.org/data/overlays/WorldWFS/PlaceNames/topp:wpl_oceans/0/0_0.xml',
  //         type: 'GET',
  //         crossOrigin: true,
  //     }).done(function(response) {
  //         console.log(response);
          
  //         var features = formatWFS.readFeatures(response);
  //         // lat and lon are the wrong way round in the WFS, so need to flip
  //         for (var i in features) {
  //           var feature = features[i];
  //           var lat = feature.getGeometry().getCoordinates()[0];
  //           var lon = feature.getGeometry().getCoordinates()[1];
  //           // convert latlon to current projection
  //           var newCoord = ol.proj.transform([lon, lat], 'EPSG:4326', map.getView().getProjection());
  //           //feature.setGeometry(new ol.geom.Point([newCoord[0], newCoord[1]]));
  //           feature.setStyle(textStyleFunction);
  //         }
  //         sourceVector.addFeatures(features);
  //         console.log(sourceVector.getFeatures());
  //     });
  //   }
  // });

  sourceVectorTile = new ol.source.VectorTile({
    tileUrlFunction: tileUrlFunction,
    format: new ol.format.WFS(),
    // minZoom: minZoom,
    // maxZoom: maxZoom,
    tileLoadFunction: function(tile, url) {
      tile.setLoader(function() {
        $.ajax({
            url: url,
            type: 'GET',
            crossOrigin: true,
            //headers: { "Accept-Encoding" : "gzip, deflate" }
        }).done(function(response) {
//            console.log(response);
            var features = formatWFS.readFeatures(response);
            tile.projection_ = map.getView().getProjection();
            // lat and lon are the wrong way round in the WFS, so need to flip
            for (var i in features) {
              var feature = features[i];
              var lat = feature.getGeometry().getCoordinates()[0];
              var lon = feature.getGeometry().getCoordinates()[1];
              // convert latlon to current projection
              var newCoord = ol.proj.transform([lon, lat], 'EPSG:4326', map.getView().getProjection());
              feature.setGeometry(new ol.geom.Point([newCoord[0], newCoord[1]]));
              feature.setStyle(textStyleFunction);
            }
            tile.setFeatures(features);
            //console.log(tile.getFeatures());
        }).fail(function(err) {
          console.log(err.responseText);
        });
      });
    }

  });

  console.log(layer.type);
  console.log("zoom: " + zoom);
  console.log("minzoom: " +minZoom);
  console.log("maxzoom: " +maxZoom);
  console.log("resolution: " + map.getView().getResolution());
  console.log((zoom >= minZoom && zoom <= maxZoom));


  function textStyleFunction() {
    return [
      new ol.style.Style({
          fill: new ol.style.Fill({
          color: 'rgba(255,255,255,0.4)'
        }),
        stroke: new ol.style.Stroke({
          color: '#3399CC',
          width: 1.25
        }),
        text: new ol.style.Text({
          font: '12px Calibri,sans-serif',
          fill: new ol.style.Fill({ color: '#000' }),
          stroke: new ol.style.Stroke({
            color: '#fff', width: 2
          }),
          // get the text from the feature - `this` is ol.Feature
          // and show only under certain resolution
          //text: map.getView().getZoom() >= minZoom ? this.get('full_name_nd') : ""
          text: this.get('full_name_nd')
        })
      })
    ];
  }

  // var layerVector = new ol.layer.Vector({
  //   source: sourceVector
  // });

  var layerVectorTile = new ol.layer.VectorTile({
    title:layer.type,
    source: sourceVectorTile,
    projection: map.getView().getProjection(),
    //style: textStyleFunction
  });
  map.addLayer(layerVectorTile);

  // var accessToken =
  //     "pk.eyJ1IjoiYWhvY2V2YXIiLCJhIjoiRk1kMWZaSSJ9.E5BkluenyWQMsBLsuByrmg";

  // For how many zoom levels do we want to use the same vector tiles?
  // 1 means "use tiles from all zoom levels". 2 means "use the same tiles for 2
  // subsequent zoom levels".
  var reuseZoomLevels = 2;

  // Offset of loaded tiles from web mercator zoom level 0.
  // 0 means "At map zoom level 0, use tiles from zoom level 0". 1 means "At map
  // zoom level 0, use tiles from zoom level 1";.
  var zoomOffset = -2;

  // // Calculation of tile urls
  // var resolutions = [];
  // for (var z = zoomOffset / reuseZoomLevels; z <= 22 / reuseZoomLevels; ++z) {
  //   resolutions.push(156543.03392804097 / Math.pow(2, z * reuseZoomLevels));
  // }

  function tileUrlFunction(tileCoord) {
    // var url =  ("http://{a-d}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/" +
    //     "{z}/{x}/{y}.vector.pbf?access_token=" + accessToken)
    //     .replace("{z}", String(tileCoord[0] * reuseZoomLevels + zoomOffset))
    //     .replace("{x}", String(tileCoord[1]))
    //     .replace("{y}", String(-tileCoord[2] - 1))
    //     .replace("{a-d}", "abcd".substr(
    //         ((tileCoord[1] << tileCoord[0]) + tileCoord[2]) % 4, 1));
    var url = "http://app.earth-observer.org/data/overlays/WorldWFS/PlaceNames/{type}/{y}/{y}_{x}.xml.gz"
      .replace('{type}', layer.type)
      .replace('{x}', tileCoord[1].toString())
      .replace(/{y}/g, (-tileCoord[2] - 1).toString());
      // .replace('{z}', String(tileCoord[0] * reuseZoomLevels + zoomOffset))
      // .replace('{x}', tileCoord[1].toString())
      // .replace(/{y}/g, (-tileCoord[2] - 1).toString());
    // var url = "http://app.earth-observer.org/data/overlays/WorldWFS/PlaceNames/{type}/{y}/{y}_{x}.xml.gz"
    //         .replace('{type}', layer.type)
    //         .replace("{z}", "0")
    //         .replace(/{y}/g, "0")
    //         .replace("{x}", "0");
   // console.log(tileCoord);
    //console.log(url);
    return url;
  }
  var test = new ol.layer.VectorTile({
    source: new ol.source.VectorTile({

      format: formatWFS,
      // tileGrid: new ol.tilegrid.TileGrid({
      //   //extent: map.getView().getProjection().getExtent(),
      //  // resolutions: resolutions
      // }),
      tileUrlFunction: tileUrlFunction
    })
  });

   //map.addLayer(test);
}
