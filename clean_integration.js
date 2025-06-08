
var waterLand = ee.Image('NOAA/NGDC/ETOPO1').select('bedrock').gt(0.0);
var waterLandBackground = waterLand.visualize({ palette: ['cadetblue', 'lightgray'] });
Map.addLayer(waterLandBackground, {}, 'background');


var today = ee.Date(Date.now());
var start = today.advance(-7, 'day');


var sstCollection = ee.ImageCollection('NOAA/CDR/OISST/V2_1')
  .filterDate(start, today)
  .select('sst');

var sst = sstCollection.mean();
var bedrock = ee.Image('NOAA/NGDC/ETOPO1').select('bedrock');
var oceanMask = bedrock.lt(0);
sst = sst.updateMask(oceanMask);

var sstVis = {
  min: 500,
  max: 3500,
  palette: [
    '040274', '0000ff', '0077ff', '00ffff',
    '00ff80', '80ff00', 'ffff00',
    'ff8000', 'ff0000', '800000'
  ]
};

Map.addLayer(sst, sstVis, 'Temperatura del Mar');


var fullDataset = ee.FeatureCollection('NOAA/IBTrACS/v4');


var regionFilters = {
  'Peninsula': ee.Filter.eq('BASIN', 'NA'),
  'Atlántico Sur': ee.Filter.eq('BASIN', 'SA'),
  'Pacífico Este': ee.Filter.eq('BASIN', 'EP'),
  'Pacífico Central': ee.Filter.eq('BASIN', 'CP'),
  'Pacífico Occidental': ee.Filter.eq('BASIN', 'WP'),
  'Índico Norte': ee.Filter.eq('BASIN', 'IO'),
  'Índico Sur': ee.Filter.eq('BASIN', 'SI'),
  'Pacífico Sur': ee.Filter.eq('BASIN', 'SP')
};


var regionCenters = {
  'Peninsula': [-75, 20],
  'Atlántico Sur': [-30, -15],
  'Pacífico Este': [-120, 15],
  'Pacífico Central': [-160, 15],
  'Pacífico Occidental': [135, 20],
  'Índico Norte': [80, 15],
  'Índico Sur': [90, -15],
  'Pacífico Sur': [-150, -20]
};


var label = ui.Label('Selecciona una región, año y ciclón');
var regionSelect = ui.Select({
  items: Object.keys(regionFilters),
  placeholder: 'Selecciona región',
  style: { width: '150px' }
});
var yearSelect = ui.Select({ items: [], style: { width: '150px' } });
var stormSelect = ui.Select({ items: [], style: { width: '150px' } });

var panel = ui.Panel([label, regionSelect, yearSelect, stormSelect], ui.Panel.Layout.flow('vertical'));
ui.root.insert(0, panel);
panel.style().set({
  width: '200px',
  maxHeight: '90%',
  position: 'top-left',
  margin: '10px',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  padding: '8px'
});


var availableYears = ['1980','1985','1990','1995','2000','2005','2010','2015','2020','2021','2022','2023'];
var currentYear = ee.Date(Date.now()).get('year').format().getInfo();
if (availableYears.indexOf(currentYear) === -1) {
  availableYears.push(currentYear);
}
yearSelect.items().reset(availableYears);
yearSelect.setValue(currentYear);


function showStorm(year, stormId) {
  Map.layers().reset();
  Map.addLayer(waterLandBackground, {}, 'background');
  Map.addLayer(sst, sstVis, 'Temperatura del Mar');

  var region = regionSelect.getValue();
  if (!region) return;

  var filter = regionFilters[region];

  var filtered = fullDataset
    .filter(ee.Filter.eq('SEASON', parseInt(year)))
    .filter(ee.Filter.eq('SID', stormId))
    .filter(filter)
    .sort('ISO_TIME');

  var list = filtered.toList(1000);
  var coords = list.map(function(f) { return ee.Feature(f).geometry().coordinates(); });
  var winds = list.map(function(f) { return ee.Feature(f).getNumber('USA_WIND'); });

  coords.evaluate(function(coordList) {
    winds.evaluate(function(windList) {
      if (coordList.length >= 2) {
        var segments = [];
        for (var i = 0; i < coordList.length - 1; i++) {
          var start = coordList[i];
          var end = coordList[i + 1];
          var wind = windList[i];
          var color = 'blue';
          if (wind >= 34 && wind <= 63) color = 'green';
          else if (wind >= 64 && wind <= 82) color = 'yellow';
          else if (wind >= 83 && wind <= 95) color = 'orange';
          else if (wind >= 96) color = 'red';

          var segment = ee.Feature(ee.Geometry.LineString([start, end]), { color: color });
          segments.push(segment);
        }

        var lineFC = ee.FeatureCollection(segments);
        var styledLine = lineFC.map(function(f) {
          return f.set('style', {
            color: f.get('color'),
            width: 3
          });
        });

        Map.addLayer(styledLine.style({ styleProperty: 'style' }), {}, 'Trayectoria');
        Map.setCenter(coordList[0][0], coordList[0][1], 6);
      } else {
        ui.Alert('Este ciclón no tiene suficientes puntos para graficar.');
      }
    });
  });


  filtered.sort('ISO_TIME').first().get('ISO_TIME').evaluate(function(isoTime) {
    if (isoTime) {
      var isoTimeFixed = isoTime.replace(' ', 'T');
      var stormDate = ee.Date(isoTimeFixed);


      var goesImage = ee.ImageCollection('NOAA/GOES/16/MCMIPF')
        .filterDate(stormDate.advance(-15, 'minute'), stormDate.advance(15, 'minute'))
        .select('CMI_C13')
        .first();

      var goesVis = {
        min: 500,
        max: 3500,
        palette: ['black', 'purple', 'blue', 'green', 'yellow', 'red']
      };
      Map.addLayer(goesImage, goesVis, 'GOES-16 IR (' + isoTime.split(' ')[0] + ')');

      var stormDateDay = stormDate.update({ hour: 0, minute: 0, second: 0 });

      var sstImage = ee.ImageCollection('NOAA/CDR/OISST/V2_1')
        .filterDate(stormDateDay, stormDateDay.advance(1, 'day'))
        .select('sst')
        .first();

      var oceanMask = ee.Image('NOAA/NGDC/ETOPO1').select('bedrock').lt(0);
      sstImage = sstImage.updateMask(oceanMask);

      var sstVis = {
        min: 500,
        max: 3500,
        palette: [
          '000080', '0000ff', '00ffff', '00ff00',
          'ffff00', 'ff8000', 'ff0000', '800000'
        ]
      };

      Map.addLayer(sstImage, sstVis, 'SST en fecha del huracán (' + isoTime.split(' ')[0] + ')');
    } else {
      print('No se encontró fecha para el ciclón seleccionado.');
    }
  });
}


function onYearChange(year) {
  stormSelect.items().reset([]);
  stormSelect.setPlaceholder('Cargando ciclones...');

  var region = regionSelect.getValue();
  if (!region) return;

  var filter = regionFilters[region];
  var dataset = fullDataset
    .filter(ee.Filter.eq('SEASON', parseInt(year)))
    .filter(filter);

  var stormInfo = dataset.aggregate_array('SID')
    .zip(dataset.aggregate_array('NAME'))
    .distinct();

  stormInfo.evaluate(function(pairs) {
    if (!pairs || pairs.length === 0) {
      stormSelect.setPlaceholder('Sin ciclones en la región');
    } else {
      var options = pairs.map(function(pair) {
        var sid = pair[0];
        var name = pair[1];
        name = name && name !== '' ? name : '(Sin nombre)';
        return { label: name + ' (' + sid + ')', value: sid };
      });

      stormSelect.items().reset(options);
      stormSelect.setValue(options[0].value, false);
    }
  });

  var center = regionCenters[region];
  if (center) Map.setCenter(center[0], center[1], 5);
}

yearSelect.onChange(onYearChange);
stormSelect.onChange(function(stormId) {
  var year = yearSelect.getValue();
  if (stormId && year) showStorm(year, stormId);
});
regionSelect.onChange(function() {
  var year = yearSelect.getValue();
  if (year) onYearChange(year);
});
regionSelect.setValue('Peninsula', false);
onYearChange(currentYear);


var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px 15px',
    backgroundColor: 'rgba(255,255,255,0.8)'
  }
});

legend.add(ui.Label({
  value: 'Leyenda: Intensidad del viento (nudos)',
  style: { fontWeight: 'bold', margin: '0 0 6px 0', fontSize: '13px' }
}));

var legendItems = [
  { color: 'blue',    label: '< 34 (Depresión)' },
  { color: 'green',   label: '34–63 (Tormenta)' },
  { color: 'yellow',  label: '64–82 (Huracán Cat 1)' },
  { color: 'orange',  label: '83–95 (Huracán Cat 2)' },
  { color: 'red',     label: '≥ 96 (Huracán Cat 3+)' }
];

legendItems.forEach(function(item) {
  var colorBox = ui.Label('', {
    backgroundColor: item.color,
    padding: '8px',
    margin: '0 8px 0 0'
  });

  var label = ui.Label(item.label, { margin: '0 0 4px 0' });
  var row = ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal'));
  legend.add(row);
});
Map.add(legend);


var sstLegend = ui.Panel({
  style: {
    position: 'top-right',
    padding: '8px 15px',
    backgroundColor: 'rgba(255,255,255,0.8)'
  }
});

sstLegend.add(ui.Label({
  value: 'Leyenda: Temperatura del mar (°C)',
  style: { fontWeight: 'bold', margin: '0 0 6px 0', fontSize: '13px' }
}));

var sstItems = [
  { color: '#000080', label: '< 5 °C' },
  { color: '#0000ff', label: '5 – 10 °C' },
  { color: '#00ffff', label: '10 – 15 °C' },
  { color: '#00ff00', label: '15 – 20 °C' },
  { color: '#ffff00', label: '20 – 25 °C' },
  { color: '#ff8000', label: '25 – 30 °C' },
  { color: '#ff0000', label: '> 30 °C' }
];

sstItems.forEach(function(item) {
  var colorBox = ui.Label('', {
    backgroundColor: item.color,
    padding: '8px',
    margin: '0 8px 0 0'
  });

  var label = ui.Label(item.label, { margin: '0 0 4px 0' });
  var row = ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal'));
  sstLegend.add(row);
});
Map.add(sstLegend);


var goesImage = ee.ImageCollection('NOAA/GOES/16/MCMIPF')
  .filterDate(ee.Date(Date.now()).advance(-1, 'hour'), ee.Date(Date.now()))
  .select('CMI_C13')
  .median();

Map.addLayer(goesImage, {
  min: 150,
  max: 300,
  palette: ['black', 'purple', 'blue', 'green', 'yellow', 'red']
}, 'GOES-16 IR (actual)');
