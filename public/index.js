 
    //these are the variables that point to useful numbers
    let totalBagsDropped;
    let totalTeams;
    let currentCounty;
    let currentTown;
    let level = 'state';
    
    // Initialize Firebase
    var config = {
      apiKey: "AIzaSyBUicpls4kgf0-sRbEqIJorP7Vj3CCGTSg",
      authDomain: "greenupvermont-dev.firebaseapp.com",
      projectId: "greenupvermont-dev",
      storageBucket: "greenupvermont-dev.appspot.com",
      messagingSenderId: "447874135722",
      appId: "1:447874135722:web:09438c19ba52b4e5de42d3"
    };
    const email = "dashboard-app@fakeuser.com"
    const password = "?secretp4$$w0rd"

    firebase.initializeApp(config);

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