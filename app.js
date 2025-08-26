
const form = document.getElementById('searchForm');
const input = document.getElementById('cityInput');
const resultArea = document.getElementById('resultArea');
const suggestList = document.getElementById('suggestList');


function renderMessage(html) {
  resultArea.innerHTML = "<div class='card'>" + html + "</div>";
}
function c(v){ return Math.round(v) + "°C"; }


function wmoToDesc(code){
  switch(Number(code)){
    case 0: return "Açık ☀️";
    case 1: case 2: case 3: return "Az/Parçalı/Çok bulutlu ⛅";
    case 45: case 48: return "Sis 🌫️";
    case 51: case 53: case 55: return "Çiseleme 🌦️";
    case 61: case 63: case 65: return "Yağmur 🌧️";
    case 71: case 73: case 75: case 77: return "Kar 🌨️";
    case 80: case 81: case 82: return "Sağanak 🌧️";
    case 95: case 96: case 99: return "Fırtına ⛈️";
    default: return "Bilinmiyor";
  }
}


function debounce(fn, delay){
  if (delay === undefined) delay = 300;
  let t;
  return function(){
    let args = arguments;
    clearTimeout(t);
    t = setTimeout(function(){ fn.apply(null, args); }, delay);
  };
}


async function geocodeByName(name){
  let url = "https://geocoding-api.open-meteo.com/v1/search" + "?name=" + encodeURIComponent(name) + "&count=8&language=tr";
  let res = await fetch(url);
  if(!res.ok) throw new Error("Geocoding hatası");
  return res.json();
}


async function getCurrentWeather(lat, lon){
  let url = "https://api.open-meteo.com/v1/forecast?"
          + "latitude=" + lat
          + "&longitude=" + lon
          + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day"
          + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code"
          + "&forecast_days=7&wind_speed_unit=kmh&timezone=auto";

  let res = await fetch(url);
  if(!res.ok) throw new Error("Hava servisi hatası");
  return res.json();
}



function hideSuggestions(){ suggestList.classList.remove('show'); suggestList.innerHTML=''; }
function showSuggestions(items){
  let html = "";
for (let i = 0; i < items.length; i++) {
  let g = items[i];
  let name = g.name + (g.admin1 ? ", " + g.admin1 : "");
  let meta = "";
  if (g.country) meta += g.country;
  if (g.timezone) {
    if (meta) meta += " · ";
    meta += g.timezone;
  }
  html += "<li data-lat='" + g.latitude + "' data-lon='" + g.longitude + "' data-name='" + name + "' data-country='" + (g.country||'') + "' data-tz='" + (g.timezone||'') + "'>" +
            "<span>" + name + "</span>" +
            "<span class='meta'>" + meta + "</span>" +
          "</li>";
}
suggestList.innerHTML = html;
suggestList.classList.add('show');

}



let handleType = debounce(async function(){
  const q = input.value.trim();
  if(q.length < 2){ hideSuggestions(); return; }

  suggestList.innerHTML = '';
  suggestList.classList.add('show');

  try{
    
    const data = await geocodeByName(q);
    const rows = data.results || [];
    if(rows.length === 0){ hideSuggestions(); return; }
    showSuggestions(rows);
  } catch (err) {
  hideSuggestions();
  console.error("Hata:", err);
}
}, 300);


suggestList.addEventListener('click', async (e)=>{
  let li = e.target;
  while (li && li.tagName !== 'LI') {
    li = li.parentElement;
  }
  if(!li) return;

  const city = {
    name: li.getAttribute('data-name'),
    country: li.getAttribute('data-country'),
    lat: parseFloat(li.getAttribute('data-lat')),
    lon: parseFloat(li.getAttribute('data-lon')),
    tz: li.getAttribute('data-tz')
  };
  input.value = city.name;
  hideSuggestions();

  await fetchAndRenderWeather(city);
});


input.addEventListener('input', handleType);

input.addEventListener('blur', ()=> setTimeout(hideSuggestions, 150));


async function fetchAndRenderWeather(city){

  document.getElementById('resultSection').style.display = 'block';
  renderMessage(
    "<div><b>" + city.name + "</b> — " + city.country + "</div>" +
    "<div class='muted'>Koordinat: lat " + city.lat + ", lon " + city.lon + " · " + city.tz + "</div>" +
    "<div class='muted'>🌐 Hava durumu isteniyor…</div>"
  );

  try{

    let w = await getCurrentWeather(city.lat, city.lon);
    let cur = w.current;
    let dailyHtml = w.daily ? renderDaily7(w.daily) : "<div class='muted'>Günlük veri alınamadı.</div>";


    let now = new Date();
    let dd = ("0" + now.getDate()).slice(-2);
    let mm = ("0" + (now.getMonth() + 1)).slice(-2);
    let yyyy = now.getFullYear();
    let hh = ("0" + now.getHours()).slice(-2);
    let min = ("0" + now.getMinutes()).slice(-2);
    let niceTime = dd + "." + mm + "." + yyyy + " " + hh + ":" + min;


    let dayText = "Gece";
    if (cur.is_day) { dayText = "Gündüz"; }


    renderMessage(
      "<div><b>" + city.name + "</b> — " + city.country + "</div>" +
      "<div class='muted'>" + city.tz + "</div>" +
      "<hr>" +
      "<div>" + wmoToDesc(cur.weather_code) + "</div>" +
      "<p class='muted'>" +
        "🌡️ Sıcaklık: <b>" + c(cur.temperature_2m) + "</b><br>" +
        "🤏 Hissedilen: <b>" + c(cur.apparent_temperature) + "</b><br>" +
        "💧 Nem: <b>%" + cur.relative_humidity_2m + "</b><br>" +
        "💨 Rüzgar: <b>" + Math.round(cur.wind_speed_10m) + " km/sa</b><br>" +
        "⌛ Zaman: <b>" + niceTime + "</b> (" + dayText + ")" +
      "</p>" +
      "<h3>Önümüzdeki 7 Gün</h3>" +
      dailyHtml
    );

  }catch(err){
    renderMessage("<b>Hata:</b> " + err.message);
    console.error("Hata:", err);
  }
}



form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if(!q) return;


  renderMessage("<div>🔎 <b>" + q + "</b> için arama yapılıyor…</div><div class='muted'>Geocoding bekleniyor</div>");
  try{
    const data = await geocodeByName(q);
    const rows = data.results || [];
    if(rows.length === 0){ renderMessage("<b>" + q + "</b> için sonuç bulunamadı."); return; }

    const g = rows[0];
    const city = {
      name: g.name + (g.admin1 ? ", " + g.admin1 : ""),
      country: g.country || '',
      lat: g.latitude, lon: g.longitude, tz: g.timezone
    };
    await fetchAndRenderWeather(city);
  }catch(err){
    renderMessage("<b>Hata:</b> " + err.message);
    console.error("Hata:", err);
  }
});



function toWeekdayShort(isoDate){
  const d = new Date(isoDate);

  const days = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
  return days[d.getDay()];
}

function renderDaily7(daily){
  let html = "";
  for (let i = 0; i < daily.time.length; i++) {
    let date = daily.time[i];
    let day = toWeekdayShort(date);
    let tmax = Math.round(daily.temperature_2m_max[i]);
    let tmin = Math.round(daily.temperature_2m_min[i]);
    let rainRaw = 0;
    if (daily.precipitation_sum && daily.precipitation_sum[i] != null) {
      rainRaw = daily.precipitation_sum[i];
    }
    let rain = Math.round(rainRaw);
    let code = daily.weather_code[i];

    html += "<div class='ditem'>" +
              "<div class='d-day'>" + day + "</div>" +
              "<div class='d-ico'>" + wmoToDesc(code) + "</div>" +
              "<div class='d-temp'><b>" + tmax + "°</b> / <span>" + tmin + "°</span></div>" +
              "<div class='d-rain'>💧 " + rain + " mm</div>" +
            "</div>";
  }
  return "<div class='dgrid'>" + html + "</div>";
}

