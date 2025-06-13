// Estaría genial poder seleccionar el Dataset.
// Agregando Datasets útiles como variables en strings.

var IBTrACS_v4 = 'NOAA/IBTrACS/v4';             // Huracanes y ciclones
var OISST_V2_1 = 'NOAA/CDR/OISST/V2_1';         // Temperatura diaria del mar desde 1981 hasta la actualidad.
var AMSR2_SST = 'JAXA/GCOM-W1/AMSR2/SST';       // Sea Surface Temperature, más reciente, resolución de 0.1° (~10km), útil para análisis más detallado.
var GOES_ABI_L2 = 'NOAA/GOES/16/ABI/L2/CMIPF';  //  Nubes y temperatura de la atmósfera (útil para ciclones)
var NASA_IMERG_V06 = 'NASA/GPM_L3/IMERG_V06';   // Precipitación: Precipitación global cada 30 minutos (~10 km).


function getDataset(model) {
    return ee.FeatureCollection(model);
}

// Do something like Hurricanes = getDataset(IBTrACS_v4)

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

var aoi = ee.Geometry.Polygon(
        [[[-97.045703125, 27.532944138338387],
          [-97.045703125, 3.870089439026666],
          [-52.74882812500001, 3.870089439026666],
          [-52.74882812500001, 27.532944138338387]]], null, false);







function t_frame(date, dt, span) {
    if (date===Null) {
        today = ee.Date(date.now())
        start = today.advance(-dt, span)
    }
    return [today, start]
}


function createPanel() {
    var label = ui.Label('Selecciona una región, año y ciclón');
    var regionSelect = ui.Select(
        {
            items: Object.keys(regionFilters),
            placeholder: 'Selecciona región',
            style: { width: '150px',
                border: '10px',
            }
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
}


function onSliderChange(region, year, wind_speed) {
    var filter = regionFilters[region];
    print(regionFilters[region]);
    
    var filtered_dataset = dataset
    .filter(ee.Filter.bounds(aoi))
    .filter(ee.Filter.eq('SEASON', parseInt(year)))
    .filter(ee.Filter.gte('USA_WIND', wind_speed))
    .filter(filter)
    
    var hurricanes_names = filtered_dataset.aggregate_array('NAME').distinct().sort()
    updateUI(hurricanes_names);

    return filtered_dataset;
}


function updateUI() {
    print("XD");
}


function onYearChange(year) {
    stormSelect.items().reset([]);
    stormSelect.setPlaceholder('Cargando Ciclones');

    var region = regionSelect.getValue();
    if (!region) return;

    var filter = regionFilters[region];
    var dataset = fullDataset
        .filter(ee.Filter.eq('SEASON', parseInt(year)))
        .filter(ee.Filter.eq(filter));

    var stormInfo = dataset.aggregate_array('SID')
        .zip(dataset.aggregate_array('NAME'))
        .distinct();

    
}
