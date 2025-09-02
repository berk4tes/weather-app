
const form = document.getElementById('searchForm');
const input = document.getElementById('cityInput');
const resultArea = document.getElementById('resultArea');
const suggestList = document.getElementById('suggestList');
let lastCity = null;
let hourlyChartRef = null;


function renderMessage(html) {
  resultArea.innerHTML = "<div class='card'>" + html + "</div>";
}
function c(v){ return Math.round(v) + "°C"; }

function wmoToDesc(code){
  code = Number(code);
  if (code === 0) return "Açık ☀️";
  if (code === 1 || code === 2 || code === 3) return "Az/Parçalı/Çok bulutlu ⛅";
  if (code === 45 || code === 48) return "Sis 🌫️";
  if (code === 51 || code === 53 || code === 55) return "Çiseleme 🌦️";
  if (code === 61 || code === 63 || code === 65) return "Yağmur 🌧️";
  if (code === 71 || code === 73 || code === 75 || code === 77) return "Kar 🌨️";
  if (code === 80 || code === 81 || code === 82) return "Sağanak 🌧️";
  if (code === 95 || code === 96 || code === 99) return "Fırtına ⛈️";
  return "Bilinmiyor";
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
  let url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=8&language=tr";
  let res = await fetch(url);
  if(!res.ok) throw new Error("Geocoding hatası");
  return res.json();
}


async function getCurrentWeather(lat, lon){
  let url = "https://api.open-meteo.com/v1/forecast?"
          + "latitude=" + lat
          + "&longitude=" + lon
          + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day"
          + "&hourly=temperature_2m,apparent_temperature"
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
  while (li && li.tagName !== 'LI') li = li.parentElement;
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
  lastCity = city;
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

    let dayText = cur.is_day ? "Gündüz" : "Gece";

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
      "<button id='favAddBtn'>⭐ Favorilere Ekle</button>" +
      "<h3>Önümüzdeki 7 Gün</h3>" +
      dailyHtml +

      "<h3>Saatlik (24 Saat)</h3>" +
      "<div class='card' id='hourlyChartWrap'><canvas id='hourlyChart' height='160'></canvas></div>"
    );

    renderHourlyChart(w);

    let favBtn = document.getElementById("favAddBtn");
    if (favBtn) {
      favBtn.addEventListener("click", function(){
        addFavorite(lastCity);
      });
    }
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
    let rain = (daily.precipitation_sum && daily.precipitation_sum[i] != null) ? Math.round(daily.precipitation_sum[i]) : 0;
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



function loadFavs(){
  let raw = localStorage.getItem("favs");
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e){ return []; }
}
function saveFavs(arr){
  localStorage.setItem("favs", JSON.stringify(arr));
}


function addFavorite(city){
  if (!city) return;
  let favs = loadFavs();

  if (favs.length >= 10){
    alert("Maksimum 10 favori ekleyebilirsin.");
    return;
  }
  for (let i = 0; i < favs.length; i++){
    if (Math.abs(favs[i].lat - city.lat) < 1e-6 && Math.abs(favs[i].lon - city.lon) < 1e-6){
      alert("Bu şehir zaten favorilerde.");
      return;
    }
  }

  favs.push({
    name: city.name,
    country: city.country || "",
    lat: city.lat, lon: city.lon,
    tz: city.tz || ""
  });
  saveFavs(favs);
  renderFavorites();
}

function removeFavorite(lat, lon){
  let favs = loadFavs();
  let out = [];
  for (let i = 0; i < favs.length; i++){
    let f = favs[i];
    if (Math.abs(f.lat - lat) < 1e-6 && Math.abs(f.lon - lon) < 1e-6){
      
    } else {
      out.push(f);
    }
  }
  saveFavs(out);
  renderFavorites();
}

async function fetchMiniWeather(f){
  try{
    const w = await getCurrentWeather(f.lat, f.lon);
    const cur = w.current;
    return { temp: Math.round(cur.temperature_2m), desc: wmoToDesc(cur.weather_code) };
  }catch(e){
    return { temp: null, desc: "—" };
  }
}

async function renderFavorites(){
  let ul = document.getElementById("favoritesList");
  if (!ul) return;

  let favs = loadFavs();
  ul.innerHTML = "";

  if (favs.length === 0){
    let li = document.createElement("li");
    li.className = "favItem";
    li.innerHTML = "<div class='fav-left'><span class='favcity'>Favori yok</span><span class='favwx'>Bir şehir seçip <b>⭐ Favorilere Ekle</b> ile ekle.</span></div>";
    ul.appendChild(li);
    return;
  }

  const minis = await Promise.all(favs.map(fetchMiniWeather));

  for (let i = 0; i < favs.length; i++){
    const f = favs[i];
    const mini = minis[i];

    const li = document.createElement("li");
    li.className = "favItem";
    li.setAttribute("data-lat", f.lat);
    li.setAttribute("data-lon", f.lon);

    const left = document.createElement("div");
    left.className = "fav-left";

    const city = document.createElement("div");
    city.className = "favcity";
    city.textContent = f.name + (f.country ? " — " + f.country : "");

    const wx = document.createElement("div");
    wx.className = "favwx";
    wx.textContent = (mini.desc || "—");

    left.appendChild(city);
    left.appendChild(wx);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "8px";

    const temp = document.createElement("div");
    temp.className = "favtemp";
    temp.textContent = (mini.temp != null ? (mini.temp + "°C") : "—");

    const delBtn = document.createElement("button");
    delBtn.className = "fav-remove";
    delBtn.textContent = "Kaldır";
    delBtn.addEventListener("click", function(e){
      e.stopPropagation();
      removeFavorite(f.lat, f.lon);
    });

    right.appendChild(temp);
    right.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(right);

    li.addEventListener("click", function(){
      fetchAndRenderWeather(f);
    });

    ul.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", function(){
  renderFavorites();
});




function renderHourlyChart(weather){

  if(!weather.hourly || !weather.hourly.time) return;

  let h = weather.hourly;
  let times = h.time;
  let temps = h.temperature_2m;

 
  let now = weather.current && weather.current.time ? weather.current.time : new Date().toISOString();
  let start = 0;
  for(let i=0;i<times.length;i++){
    if(times[i] >= now){ start = i; break; }
  }
  let end = start+24;
  if(end > times.length) end = times.length;

 
  let labels = [];
  let data = [];
  for(let i=start;i<end;i++){
    let d = new Date(times[i]);
    let hhh = d.getHours();
    let mmm = d.getMinutes();
    if(hhh<10) hhh = "0"+hhh;
    if(mmm<10) mmm = "0"+mmm;
    labels.push(hhh+":"+mmm);
    data.push(Math.round(temps[i]));
  }

  let c = document.getElementById("hourlyChart");
  if(!c) return;


  if(hourlyChartRef){
    hourlyChartRef.destroy();
  }


  hourlyChartRef = new Chart(c, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Sıcaklık (°C)",
        data: data,
        borderColor: "orange",
        tension: 0.4
      }]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ display:false } }
    }
  });
}
