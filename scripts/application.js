$(document).ready(function() {
  initializeAutocomplete();
  initializeClickHandlers();
  initializeInterface();
});

var autocomplete;
var jsonpCallbacks = { counter: 0 };

/*
 *	Called on page load.
 */
function initializeAutocomplete() {
  var input = document.getElementById("address-input");
  var options = {
    types: ["geocode"],
    componentRestrictions: { country: "us" }
  };
  autocomplete = new google.maps.places.Autocomplete(input, options);
  // When the user selects an address from the dropdown, geocode the location
  google.maps.event.addListener(
    autocomplete,
    "place_changed",
    getAutocompleteResults
  );
}

/*
 *	Called on page load.
 */
function initializeClickHandlers() {
  $("#autolocate").click(autolocateClickHandler);
  $("#details-back").click(transitionToResultsView);
}

/*
 *	Called on page load.
 */
function initializeInterface() {
  $(".spinner").hide();
}

/*
 *	Called when the button on the left of the search bar is clicked.
 */
function autolocateClickHandler() {
  $(".spinner").show();
  getLocationBasedOnIpAddress();
}

/*
 *	Called when the button on the left of the search bar is clicked.  Sends a request for location based on ip address and passes the results to a result handler.
 */
function getLocationBasedOnIpAddress() {
  $.ajax({
    type: "GET",
    contentType: "application/json; charset=utf-8",
    url: "http://www.telize.com/geoip/",
    dataType: "jsonp",
    jsonpCallback: "locationBasedOnIpAddressResultsHandler"
  });
}

/*
 *  Handles the json response for the location based on ip address request.  The search bar is populated with the city indicated in the response.
 */
function locationBasedOnIpAddressResultsHandler(results) {
  $("#address-input").val(results["city"]);
  getFarmersMarketsByGeolocation(results["latitude"], results["longitude"]);
}

/*
 *	Called when we have a latitude and longitude from either the google autocomplete search or the ip location search.  
 *	Sends a request to the USDA farmers market API for a market list and passed the results to a result handler. 
 */
function getFarmersMarketsByGeolocation(latitude, longitude) {
  $(".spinner").show();
  $.ajax({
    type: "GET",
    contentType: "application/json; charset=utf-8",
    // submit a get request to the restful service locSearch.
    url:
      "http://search.ams.usda.gov/farmersmarkets/v1/data.svc/locSearch?lat=" +
      latitude +
      "&lng=" +
      longitude,
    dataType: "jsonp",
    jsonpCallback: "farmersMarketSearchResultsHandler"
  });
}

/*
 *  Handles the json response for market list request.  The UI is updated and the market list is populated to the screen.
 */
function farmersMarketSearchResultsHandler(searchResults) {
  transitionToResultsView();
  $("#results").empty();
  for (var key in searchResults.results) {
    var id = searchResults.results[key].id;
    var marketname = searchResults.results[key].marketname;
    var distance = marketname.split(" ", 1);
    var name = marketname.substring(
      distance.toString().length,
      marketname.toString().length
    );
    $("#results").append(
      '<div class="tr"><span class="td hidden">' +
        id +
        '</span><span class="td">' +
        distance +
        '<span class="small">mi</span></span><span class="td">' +
        name +
        '</span><span class="td"><img id="details" src="./images/view_details-48.png" alt="Details" height="40" width="40"></span></div>'
    );
  }
  $(".tr").click(function() {
    createFarmersMarketDetailsCallback($(this));
  });
}

// Bias the autocomplete object to the user's geographical location,
// as supplied by the browser's 'navigator.geolocation' object.
function geolocate() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var geolocation = new google.maps.LatLng(
        position.coords.latitude,
        position.coords.longitude
      );
      autocomplete.setBounds(
        new google.maps.LatLngBounds(geolocation, geolocation)
      );
    });
  }
}

function getAutocompleteResults() {
  var place = autocomplete.getPlace();
  if (place.geometry) {
    getFarmersMarketsByGeolocation(
      place.geometry.location.lat(),
      place.geometry.location.lng()
    );
  }
}

/*      Farmer Market Detail Search Flow        */
function getFarmersMarketDetails(id, callbackFuncName) {
  $.ajax({
    type: "GET",
    contentType: "application/json; charset=utf-8",
    // submit a get request to the restful service mktDetail.
    url:
      "http://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=" +
      id,
    dataType: "jsonp",
    jsonpCallback: callbackFuncName
  });
}

function createFarmersMarketDetailsCallback(market) {
  transitionToDetailsView();
  var id = market.children(":first").text();

  // create a globally unique function name
  var fnname = "fn" + jsonpCallbacks.cntr++;

  // put that function in a globally accessible place for JSONP to call
  jsonpCallbacks[fnname] = function(detailresults) {
    // upon success, remove the name
    delete jsonpCallbacks[fnname];
    // now call the desired callback internally and pass it the id

    var marketDetails;
    for (var key in detailresults) {
      marketDetails = detailresults[key]; //there is only ever one result returned
    }

    var marketName = market.children(":nth-child(3)").text();

    marketDetails["Name"] = marketName;
    marketDetails["Distance"] = market
      .children(":nth-child(2)")
      .text()
      .replace("mi", "");

    // I was forced to parse the provided google link to pull the latitude and longitude of the farmers market
    var strToParse = marketDetails["GoogleLink"];
    var firstPercentIndex = strToParse.indexOf("%");
    var latitude = strToParse.slice(26, firstPercentIndex);
    var longitude = strToParse.slice(
      firstPercentIndex + 6,
      strToParse.indexOf("%", firstPercentIndex + 6)
    );

    var map;
    var myLatlng = new google.maps.LatLng(latitude, longitude);
    var mapOptions = {
      scrollwheel: false,
      navigationControl: false,
      mapTypeControl: false,
      scaleControl: false,
      draggable: false,
      zoom: 14,
      center: myLatlng
    };
    var marker = new google.maps.Marker({
      position: myLatlng,
      map: map,
      title: marketName
    });
    setTimeout(function() {
      map = new google.maps.Map(
        document.getElementById("map-canvas"),
        mapOptions
      );
      marker.setMap(map);
    }, 350);

    populateMarketDetails(marketDetails);
  };

  getFarmersMarketDetails(id, "jsonpCallbacks." + fnname);
}

function transitionToDetailsView() {
  $("#results").fadeOut(300);
  $("#market-details")
    .delay(350)
    .fadeIn(400);
}

function transitionToResultsView() {
  $("#market-details").fadeOut(300);
  $(".spinner")
    .delay(300)
    .fadeOut(300);
  setTimeout(clearMarketDetails, 325);
  $("#results")
    .delay(350)
    .fadeIn(400);
}

function clearMarketDetails() {
  $("#details-name").empty();
  $("#details-distance").empty();
  $("#details-address ul").empty();
  $("#details-schedule ul").empty();
  $("#details-products ul").empty();
}

function populateMarketDetails(marketDetails) {
  //there seems to be a lot of random <br> tags in the data lets get rid of them and clean it up a little with a trim
  marketDetails["Address"] = marketDetails["Address"].split("<br>").join("");
  marketDetails["Schedule"] = marketDetails["Schedule"].split("<br>").join("");
  marketDetails["Products"] = marketDetails["Products"].split("<br>").join("");
  marketDetails["Address"] = marketDetails["Address"].trim();
  marketDetails["Schedule"] = marketDetails["Schedule"].trim();
  marketDetails["Products"] = marketDetails["Products"].trim();

  //the data seems to be split logically with semi-colons so lets split it into an array so we can put it in a list real easy like
  marketDetails["Address"] = marketDetails["Address"].split(";");
  marketDetails["Schedule"] = marketDetails["Schedule"].split(";");
  marketDetails["Products"] = marketDetails["Products"].split(";");

  //this is data from the listing results so lets just display it
  $("#details-name").text(marketDetails["Name"]);
  $("#details-distance").text(marketDetails["Distance"]);
  $("#details-distance").append('<span class="small">mi</span>');

  //now lets create those lists we mentioned earlier
  for (var key in marketDetails["Address"]) {
    if (key) {
      $("#details-address ul").append(
        '<li><a href="' +
          marketDetails["GoogleLink"] +
          '">' +
          marketDetails["Address"][key].trim() +
          "</a></li>"
      );
    }
  }

  if (
    marketDetails["Schedule"].length == 1 &&
    marketDetails["Schedule"].shift().trim() == ""
  ) {
    $("#details-schedule ul").append(
      "<li>Schedule information unavailable.</li>"
    );
  } else {
    for (var key in marketDetails["Schedule"]) {
      if (key) {
        $("#details-schedule ul").append(
          "<li>" + marketDetails["Schedule"][key].trim() + "</li>"
        );
      }
    }
  }

  if (
    marketDetails["Products"].length == 1 &&
    marketDetails["Products"].shift().trim() == ""
  ) {
    $("#details-products ul").append(
      "<li>Product information unavailable.</li>"
    );
  } else {
    for (var key in marketDetails["Products"]) {
      if (key) {
        $("#details-products ul").append(
          "<li>" + marketDetails["Products"][key].trim() + "</li>"
        );
      }
    }
  }
}
