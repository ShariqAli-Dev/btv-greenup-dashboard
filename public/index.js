 
    //these are the variables that point to useful numbers
    let totalBagsDropped;
    let totalTeams;
    let currentCounty;
    let currentTown;
    let level = 'state';
    
    // Firebase is auto-initialized by /__/firebase/init.js (Firebase Hosting
    // serves it with the active project's config). See README.md.
    const KNOWN_PROJECTS = new Set([
      'greenupvermont-dev',
      'greenupvermont-de02b', // prod
    ]);

    const email = "dashboard-app@fakeuser.com"
    const password = "?secretp4$$w0rd"

    function showUnknownEnvironmentError(projectId) {
      // loading.js's animation chain has no stop condition; null its functions.
      ['loadingAnimation0', 'loadingAnimation1', 'loadingAnimation2', 'loadingAnimation3']
        .forEach(function (fn) { if (window[fn]) window[fn] = function () {}; });

      console.error(
        '[GreenUpDashboard] Unknown Firebase project — refusing to load data.\n' +
        'projectId: ' + projectId + '\n' +
        'Expected one of: ' + Array.from(KNOWN_PROJECTS).join(', ')
      );

      var refValue = projectId || '(no firebase app initialized)';
      document.getElementById('unknownEnvRef').textContent = refValue;
      document.getElementById('unknownEnvEmail').href =
        'mailto:nick.floersch@codeforbtv.org?subject=' +
        encodeURIComponent('Green Up Vermont Dashboard \u2014 unknown environment (' + refValue + ')');

      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('unknownEnvScreen').hidden = false;
    }

    let projectId = null;
    try {
      projectId = firebase.app().options.projectId;
    } catch (e) {
      // /__/firebase/init.js never ran — fall through to the unknown-env handler.
    }

    if (!projectId || !KNOWN_PROJECTS.has(projectId)) {
      showUnknownEnvironmentError(projectId);
    } else {
      firebase.auth().signInWithEmailAndPassword(email, password)
      .then(() =>{
          vermont.getFirebaseData()
      })
      .catch(function (error) {
        // ToDo: handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        throw ("There has been a problem <br>" + errorCode +"<br>" + errorMessage)
      });
    }

    function handlePrint(){
      let chartDiv = document.getElementsByClassName('hiddenChart')[0]
      console.log(chartDiv)
     let barChart = document.getElementById('barChart')
     if(barChart) {
      chartImg = barChart.toDataURL()
      console.log(chartImg)
    
      chartDiv.innerHTML = '<img id="chartImg" src="' + chartImg + '">'
     }
     window.setTimeout(() => window.print(), 100)
    }

    function openAbout(event) {
      event.stopPropagation()
      aboutDiv = document.getElementById('aboutScreen')
      aboutDiv.style = 'display: block'
    }

    function closeAbout() {
      aboutDiv = document.getElementById('aboutScreen')
      aboutDiv.style = 'display: none'
      console.log('close fired')
    }
    aboutDiv = document.getElementById('aboutScreen')
    aboutDiv.addEventListener('click', (event) => {
      console.log('close canceled')
      event.stopPropagation()})
    window.addEventListener('click', closeAbout)
    let vermont = new Vermont