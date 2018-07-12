$(document).ready(function() {

  /*
    Display the menu when the menu button is clicked
  */
  $("#menu_btn").click(function() {
      $("#menu").show();
      $("#menu_btn").hide();
  });

  /*
    Hide the menu when the hide button is clicked
  */
  $("#hide_btn").click(function() {
      $("#menu").hide();
      $("#menu_btn").show();
  });

  /* 
    Close the popup when the close button is clicked
  */
  $("#close_btn").click(function() {
      $("#popup").hide();
  });

  /*
    Stop the audio when the silent button is clicked
  */
  $("#silent_btn").click(function() {
    var audioElement = document.getElementById("popup_audio");
    audioElement.pause();
  });

  /*
    Take a snapshot of the main map canvas and save as a jpeg file
    (can't use png as some canvases are too large) 
  */
  $("#screenshot_btn").click(function() {
   
    var canvas = $("#map").find("canvas")[0];
    var image = canvas.toDataURL("image/jpeg");
    var link=document.createElement("a");
    link.href=image; 
    link.download = 'PolarExplorer_snapshot.jpg';
    link.click();   
  });

  /*
    Display the settings menu when the settings button is clicked
  */
  $("#settings_btn").click(function() {
    $("#settings").show();
  });

  /*
    Close the settings menu when the close settings button is clicked
  */
  $("#close_settings_btn").click(function() {
    $("#settings").hide();
  });

  /*
    Toggle the scalebar with the scalebar switch
  */
  $("#scalebar_switch").click(function() {
    $("#scaleline").toggle(this.checked);
  });

  /*
    Toggle the legend with the legend switch
  */
  showLegendSetting = true;
  $("#legend_switch").click(function() {
    showLegendSetting = this.checked;
    if ($("#legend_img").attr("src") && $("#legend_img").attr("src") !== "") {
      $("#legend").toggle(this.checked);
    }
  });

  /*
    Toggle place name labels with the place names switch
  */
  $("#place_names_switch").click(function() {
    placeNamesLayer.setVisible(this.checked);
  });

  /*
    Toggle the RGB function with the RGB switch
  */
  showRGB = false;
  $("#rgb_switch").click(function() {
    showRGB = this.checked;
  });

  /*
    Toggle whether to display the user's location with the location switch.
    This will only work if we switch to https
  */
  $("#location_switch").click(function() {
    geolocation.setTracking(this.checked);
    if (this.checked) map.addLayer(geolocationLayer);
    else map.removeLayer(geolocationLayer);
  });

  // Set some initial values
  parents = [];
  showElevation = true;
  scaleTable = {};
  scaleUnits = "";
  tablePopupObj = {};
  showSeabedNames = true;

  // Populate the menu using the overlays in the mapOverlays.json file
  console.log(mapOverlays);
  populateMenu(mapOverlays, null);

  //display place names
  displayPlaceNameFeatures();

  /*
    Elements that make up the popup.
  */
  container = document.getElementById('table-popup');
  content_element = document.getElementById('table-popup-content');
  closer = document.getElementById('table-popup-closer');

  /*
    Create an overlay to anchor the popup to the map.
  */
  var table_popup_overlay = new ol.Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: {
      duration: 250
    }
  });

  map.addOverlay(table_popup_overlay);

  /*
   Add a click handler to hide the popup.
  */
  closer.onclick = function() {
    table_popup_overlay.setPosition(undefined);
    closer.blur();
    return false;
  };

  /*
    Handle what happens if the user clicks on the map
  */
  map.on('click', function(evt) {
    $("#elev").text("");
    var x = evt.pixel[0];
    var y = evt.pixel[1];

    //first check if clicking on a circle in a table layer
    var feature = map.forEachFeatureAtPixel(evt.pixel, 
      function(feature, layer) {
        return feature;
      }, {"hitTolerance":7});
    if (feature) {
        //ignore placename label features
        if (typeof feature.fontName != "undefined") return 

        var geometry = feature.getGeometry();
        var feature_coord = geometry.getCoordinates();
        var content="";

        console.log(tablePopupObj);
        var url;
        if (tablePopupObj.base_url && tablePopupObj.url_property) {
          url = tablePopupObj.base_url + feature.get(tablePopupObj.url_property);
        }
        else if (tablePopupObj.base_url && !tablePopupObj.url_property) {
          url = tablePopupObj.base_url;
        }
        else if (!tablePopupObj.base_url && tablePopupObj.url_property) {
          url = feature.get(tablePopupObj.url_property);
        }

        var image_url;
        if (tablePopupObj.image_base_url && tablePopupObj.image_url_property) {
          image_url = tablePopupObj.image_base_url + feature.get(tablePopupObj.image_url_property);
        }
        else if (tablePopupObj.image_base_url && !tablePopupObj.image_url_property) {
          image_url = tablePopupObj.image_base_url;
        }
        else if (!tablePopupObj.image_base_url && tablePopupObj.image_url_property) {
          image_url = feature.get(tablePopupObj.image_url_property);
        }
        if (image_url) content += "<a target='_blank' href='" + url + "'><img src='" + image_url +"'></img></a><br/>";


        for (var i in tablePopupObj.properties) {
          var key = tablePopupObj.properties[i];
          content += key + " = " + feature.get(key).replace("|", ",") + tablePopupObj.units[i] + "<br/>";
        }

        if (url) content += "<a target='_blank' href='" + url + "'>More info</a>";
        
        content_element.innerHTML = content;
        table_popup_overlay.setPosition(feature_coord);
        $("#table-popup").css("width", "max-content");
        console.info(feature.getProperties());

    } else if (showRGB) {
      //Show ARGB value at pixel
      var hidden_map1 = document.getElementById("hidden_map");

      var canvas1 = hidden_map1.getElementsByTagName("canvas");
      var ctx1 = canvas1[0].getContext("2d");
      var ratio1 = getPixelRatio(ctx1);
      var p1 = ctx1.getImageData(x*ratio1, y*ratio1, 1, 1).data; 
      var argb = "ARGB: " + p1[3] + ", " + p1[0] + ", " + p1[1] + ", " + p1[2];
      $("#elev").text(argb).css({top:y-35+"px", left:x-10+"px", position:"absolute", color:"white"}).show();

    } else if (showElevation) {

      var coord = map.getCoordinateFromPixel([x,y]);
      var ll = ol.proj.toLonLat(coord, map.getView().getProjection());
      $.ajax({
        type:"GET",
        url:gmrtUrl,
        data: {
          "format": "text/plain",
          "longitude": ll[0].toFixed(7),
          "latitude": ll[1].toFixed(7)
        },
        success: function(response) {
          var textColor;
          if (parseFloat(response) > 0) {
            textColor = "#ffcc00";
          } else {
            textColor = "#99ccff";
          }
          $("#elev").text(response+" meters").css({top:y-35+"px", left:x-10+"px", position:"absolute", color:textColor}).show();
        }
      });

    } else{
      // get z-value from the hidden map which displays only the top layer
      // (this prevents trying to get values from the base map)
      var hidden_map = document.getElementById("hidden_map");
      var canvas = hidden_map.getElementsByTagName("canvas");
      var ctx = canvas[0].getContext("2d");
      var ratio = getPixelRatio(ctx);
      var p = ctx.getImageData(x*ratio, y*ratio, 1, 1).data; 
      // find closest color in the scaleTable
      closest = getClosestColor(p[0], p[1], p[2]);
      console.log(map.getView().getZoom());
      console.log(p);
      console.log(closest);
      if (closest) {
        $("#col_sq").css('background-color', 'rgb('+closest+')');
        var z_val = scaleTable[closest];
        $("#elev").text(z_val).css({top:y-35+"px", left:x-10+"px", position:"absolute", color:"white"}).show();
      }
    }
  });

  //Make the DIV element draggagle:
  dragElement(document.getElementById(("menu")));
  dragElement(document.getElementById(("popup")));
  dragElement(document.getElementById(("legend")));
  dragElement(document.getElementById(("settings")));  
});


/*
  Populate the menu using the overlays in the mapOverlays.json file
*/
function populateMenu(overlays) {
  var menu = $("#menu_list");
  //clear the menu
  menu.empty();
  //don't show back button if no parents in list
  if (parents.length === 0) {
    $("#back_btn").hide();
  }

  //add menu items for each child overlay
  $.each(overlays, function(i) {
    var item;
    var row = $("<tr/>");
    var info = $("<td/>");
    var info_link = $("<a/>").attr("target", "_blank");
    var more = $("<td/>");
    var info_icon = $("<i/>").addClass("menu_icon menu_info");
    var icon = $("<i/>").addClass("menu_icon");
    var overlay = overlays[i];

    //add info icon of overlay contains info url
    if (overlay.info) {
      info_icon.addClass("fa fa-info-circle");
      info_link.append(info_icon);
      info_link.attr("href", overlay.info);
      info.append(info_link);
    }
    //if overlay is of type overview, set as menu header
    if (overlay.type == "overview") {
      item = $("<th/>").text(overlay.name);
      row.addClass("menu_overview");
      more.append(icon);
    //add as menu item
    } else {
      item = $("<td/>").text(overlay.name);
      row.addClass("menu_item");
      //handle click event
      item.click(function() {
        menuItemClicked(overlay, overlays, icon);
      });
      more.click(function() {
        menuItemClicked(overlay, overlays, icon);
      });
      //if overlay is of type dir, add an angle-right icon
      if (overlay.type == "dir") {
        icon.addClass("fa fa-angle-right");
      }
      more.append(icon);
    }
    row.append(info);
    row.append(item);
    row.append(more);
    menu.append(row);
  });
}

/*
  Function to handle what to do when a menu item is clicked
*/
function menuItemClicked(overlay, parent, icon) {
  //if current menu item, don't do anything
  if (icon.hasClass("fa-check")) return;
  //perform appropraite action depending on overlay type
  console.log(overlay.type);
  switch(overlay.type) {
    //sub-menu
    case "dir":
      //keep track of parents in case back button is pressed
      parents.push(parent);
      var $menu = $("#menu_list");
      //repopulate menu with childrem of this item
      populateMenu(overlay.children);
      $("#back_btn").unbind('click').click(function() {
        //repopulate menu with parent
        populateMenu(parents.pop());
      }).show();
      break;
    case "tile_512":
      displayTile512(overlay, true);
      break;
    case "wms_512":
      displayWMS512(overlay, true);
      break;
    case "overlay_sequence":
      displayOverlaySequence(overlay, true);
      break;
    case "NOAAtile_256":
      displayNOAA(overlay, true);
      break;
    case "arcgis_tile_256":
      displayArcGIS(overlay, true);
      break;
    case "arcgis_image":
      displayArcGISImage(overlay, true);
      break;
    case "xb_map":
      displayXBMap(overlay, true);
      break;
    case "multi_layer":
      displayMultiLayers(overlay);
      break;
    case "table":
      displayTable(overlay, true);
      break;
    default:
      console.log("Unknown Overlay Type: " + overlay.type);
  }
  //place a check mark next to the selected row
  $(".fa-check").removeClass("fa fa-check");
  icon.addClass("fa fa-check");

  //show the popup with text and audio
  showPopup(overlay);   
}

/*
  Remove all layers except the GMRT base and perform any other tidying up 
  before switching to new overlay.  Only remove GMRT base layer if removeGMRT is
  set to true, eg if the overlay.hideOpacitySlider has been set to true, or if 
  this is a multi_layer overlay 
*/
function removeAllLayers(removeGMRT = false) {
  console.log(removeGMRT);     
  map.setLayerGroup(new ol.layer.Group());
  if (!removeGMRT) map.addLayer(gmrtLayer);
  if (showSeabedNames) map.addLayer(placeNamesLayer);
  $("#sequence").hide(); 
  $("#legend").hide();
  $("#opacity").hide(); 
  $("#ldeo_label").hide();
  $("#elev").text("");  
  scaleTable = {};  
  scaleUnits = ""; 
  closer.click();
}  

/*
  A function to remove a layer using its name/title
*/
function removeLayerByName(name) {
  var layersToRemove = [];
  map.getLayers().forEach(function (layer) {
    if (layer.get('title') !== undefined && layer.get('title') === name) {
        layersToRemove.push(layer);
    }
  });

  var len = layersToRemove.length;
  for(var i = 0; i < len; i++) {
      map.removeLayer(layersToRemove[i]);
  }
}

/*
  make sure all tables are removed by removing any untitled vector layers 
*/
function removeAllTables() {
  var layersToRemove = [];
  map.getLayers().forEach(function (layer) {
    if (layer.type == "VECTOR" && layer.get('title' === undefined)) {
        layersToRemove.push(layer);
    }
  });

  var len = layersToRemove.length;
  for(var i = 0; i < len; i++) {
      map.removeLayer(layersToRemove[i]);
  }
   
  tablePopupObj = {};
} 

/*
  Show the popup for the selectd overlay
*/
function showPopup(overlay) {
  if (!overlay.aboutAlertURL) {
    $("#popup").hide();
    return;
  }
  //get the text for the popup
  $.ajax({
    type: "GET",
    url: overlay.aboutAlertURL,
    crossOrigin: true,
    success: function(response) {
      var text = response.replace(/â/g, "'").split(":");
      $("#popupheader").text(overlay.name);
      $("#popup_text").text(text[1]);

      //play the audio
      if (overlay.aboutAudioURL) {
        $("#audio_btn").click(function() {
          playAudio(overlay.aboutAudioURL);
        });
      }
      $("#popup").show();
    }
  });
}

/*
  Play the audio given a url
*/ 
function playAudio(url) {
  var audioElement = document.getElementById("popup_audio");
  audioElement.src = url;
  audioElement.play();
}

/*
  Show the legend for an overlay
*/
function showLegend(overlay) {
  $("#legend_img").attr("src",overlay.legendPath);
  if (showLegendSetting) $("#legend").show();
}

/*
  Display the layer title
*/
function showTitle(title) {
  $("#layer_title").text(title);
}

/*
  Display the layer credit
*/
function showCredit(credit) {
  $("#layer_credit").text("    Credit: " + credit);
}

/* 
  set the link for the info button
*/
function setInfoLink(url) {
  $("#info_link").attr("href", url).show();
}

/*
  Get the scale table for a layer using the scalePath.
  This will be used to get the z-values on clicking the map.
*/
function getScaleTable(scalePath) {
  $.ajax({
    type: "GET",
    url: scalePath,
    crossOrigin: true,
    success: function(response) {
      var lines = response.split("\n");
      for (var i in lines) {
        var line = lines[i].split("\t");
        if (line[0] !== "R,G,B" && line[0] !== "") scaleTable[line[0]] = line[1];
      }
    }
  });
}

/*
  setup the opacity slider
*/
function setSlider(layer, overlay) {
  if (overlay.hideOpacitySlider) {
    ($("opacity").hide());
    return;
  }
  //only want to change opacity of top layer, so need to unbind previous layers
  $("#opacity_slider").unbind(); 
  $("#opacity_slider").on("input", function(e) {
    layer.setOpacity($(e.target).val());
  });

  $("#opacity").show();
}

/*
  Everything that needs to be done when displaying a layer on the map
*/
function displayLayer(layer, overlay, removeOldLayers) {
  
  //determine whether place names should be shown
  showSeabedNames = overlay.showSeabedNames;
  
  //remove old layers if not a multilayer layer
  //only remove GMRT base layer is the hideOpacitySlider parameter is true
  //or if the overlay type is multi_layer
  if (removeOldLayers) removeAllLayers(overlay.hideOpacitySlider || overlay.parent_type == "multi_layer");
  
  //switch projection if necessary
  if (!overlay.mapProjection) {
    if (map.getView().getProjection() != merc_proj) switchProjection(0); 
  }

  //add the new layer to the map
  map.addLayer(layer);

  //set the opacity slider
  setSlider(layer, overlay);  

  //show legend if available
  if (overlay.legend) {
    showLegend(overlay);
  } else {
    $("#legend_img").attr("src", "");
  }
  if (overlay.info) {
    setInfoLink(overlay.info);
  }
  if (overlay.title) {
    showTitle(overlay.title);
  }
  if (overlay.credit) {
    showCredit(overlay.credit);
  }
  if (overlay.scalePath) {
    getScaleTable(overlay.scalePath);
  }
  if (overlay.LegendUnits) {
    scaleUnits = overlay.LegendUnits;
  }
  if (overlay.type != "dir") {
    showElevation = overlay.showElevation;
  }  
  if (overlay.type == "overlay_sequence") {
    $("#sequence").show();
  }

  //on map 2 (the hidden map), just display top layer
  map2.setLayerGroup(new ol.layer.Group());
  map2.addLayer(layer);
}

/*
  scale for Retina and other hi-res displays
*/
function getPixelRatio(ctx) {
  var devicePixelRatio = window.devicePixelRatio || 1;
  var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                      ctx.mozBackingStorePixelRatio ||
                      ctx.msBackingStorePixelRatio ||
                      ctx.oBackingStorePixelRatio ||
                      ctx.backingStorePixelRatio || 1;
  var ratio = devicePixelRatio / backingStoreRatio;
  return ratio;
}

/*
  find closest color in the scaleTable
*/
function getClosestColor(r0,g0,b0) {
  var land_greys = ["0", 192, 203, 178];
  if (r0 == b0 && b0 == g0 && ($.inArray(r0, land_greys))) return null;
  var min = 999999;
  var closest = null;
  console.log(scaleTable);
  for (var j in Object.keys(scaleTable)) {
    var rgb1 = Object.keys(scaleTable)[j].split(',');
    var r1 = parseInt(rgb1[0]);
    var g1 = parseInt(rgb1[1]);
    var b1 = parseInt(rgb1[2]);
    var d =   Math.pow(r0-r1,2) + Math.pow(g0-g1,2) + Math.pow(b0-b1,2);
    if (d < min) {
      closest = rgb1;
      min = d;
    }
  }
  return closest;
}

/*
  functions to hangle dragging an element by its header
*/
function dragElement(elmnt) {
  if (elmnt === null) return;
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (document.getElementById(elmnt.id + "header")) {
    /* if present, the header is where you move the DIV from:*/
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  } else {
    /* otherwise, move the DIV from anywhere inside the DIV:*/
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null;
    document.onmousemove = null;
  }
}