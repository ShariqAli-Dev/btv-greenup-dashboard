const FIRESTORE_ID_TO_GEOJSON_TOWNNAME = {
    'ST_ALBANS_TOWN':   'ST. ALBANS TOWN',
    'ST_ALBANS_CITY':   'ST. ALBANS CITY',
    'ST_JOHNSBURY':     'ST. JOHNSBURY',
    'ST_GEORGE':        'ST. GEORGE',
    'ESSEX_JCT':        'ESSEX',           // village within Essex — no separate polygon
    'WEST BRATTLEBORO': 'BRATTLEBORO',     // CDP within Brattleboro — no separate polygon
}

function firestoreTownIdToTownKey(townId) {
    if (townId == null) return null
    const geoName = FIRESTORE_ID_TO_GEOJSON_TOWNNAME[townId] !== undefined
        ? FIRESTORE_ID_TO_GEOJSON_TOWNNAME[townId]
        : townId.replace(/_/g, ' ')
    return geoName.toLowerCase()
}

function findTownByKey(vermontInstance, townKey) {
    if (!townKey) return undefined
    for (const countyName in vermontInstance.counties) {
        const county = vermontInstance.counties[countyName]
        if (county.towns[townKey]) return county.towns[townKey]
    }
    return undefined
}

function townKeyForCoordinates(longitude, latitude) {
    if (longitude == null || latitude == null) return null
    const townBoundaries = L.geoJSON(townPolygons)
    const results = leafletPip.pointInLayer([longitude, latitude], townBoundaries, true)
    if (results.length === 0) return null
    return results[0].feature.properties.TOWNNAME.toLowerCase()
}

class Vermont {
    constructor() {
        this.counties = {
            
        }
        this.stats = {
            
        }
        this.getCounties()
        this.getTowns()
    }
    getCounties() {
        //Puts a county object for each Vermont county into the vermontObject
        let counties =countyPolygons.features
        for (let county in counties) {
            let countyName = counties[county].properties.CNTYNAME.toLowerCase()
            this.counties[countyName] = new County(countyName)
        } 
    }
    getTowns() {
        //Puts a town object for each town in vermont into it's appropriate county object
        for (let town in townPolygons.features) {
            let townName = townPolygons.features[town].properties.TOWNNAME.toLowerCase()
            let CNTYNum = townPolygons.features[town].properties.CNTY
            this.countyNumber(CNTYNum).towns[townName] = new Town(townName)
        }
    }
 
    // log any Firestore townId that doesn't resolve to a GeoJSON polygon so schema drift is caught at startup instead of silently mis-bucketing data.
    verifyTownIdReconciliation(teamsArr, dropsArr) {
        const seen = new Set()
        const unmapped = new Set()
        const probe = (townId, source) => {
            if (townId == null) return
            if (seen.has(townId)) return
            seen.add(townId)
            const townKey = firestoreTownIdToTownKey(townId)
            if (!findTownByKey(this, townKey)) {
                unmapped.add(`${townId} (from ${source}, computed key: ${townKey})`)
            }
        }
        for (const team of teamsArr) {
            probe(team.townId, 'team.townId')
            if (team.locations && team.locations[0]) {
                probe(team.locations[0].townId, 'team.locations[0].townId')
            }
        }
        for (const drop of dropsArr) {
            if (drop.location) probe(drop.location.townId, 'drop.location.townId')
        }
        if (unmapped.size > 0) {
            console.error(
                '[town reconciliation] Firestore townIds with no matching GeoJSON polygon. ' +
                'Update FIRESTORE_ID_TO_GEOJSON_TOWNNAME or re-run .research-scratch/diff-towns.js:',
                Array.from(unmapped),
            )
        } else {
            console.log('[town reconciliation] all Firestore townIds map cleanly')
        }
    }

    async getFirebaseData() {
        console.log('Getting Data (Firestore)')
        const db = firebase.firestore()

        // profiles is auth-gated — requires the dashboard-app user to be signed in.
        const [teamsSnap, dropsSnap, profilesSnap] = await Promise.all([
            db.collection('teams').get(),
            db.collection('trashDrops').get(),
            db.collection('profiles').get(),
        ])
        // `id` AFTER the spread: 28/43 team docs store a stale `id: null` field
        // that would otherwise clobber the real doc ID and crash .doc(team.id).
        const teamsArr = teamsSnap.docs.map(d => ({ ...d.data(), id: d.id }))
        const dropsArr = dropsSnap.docs.map(d => ({ ...d.data(), id: d.id }))
        const profilesCount = profilesSnap.size

        // Per-team member counts via the auth-gated members subcollection.
        // `.count()` aggregation queries aren't in Firebase JS SDK v8.10.1, so
        // we full-fetch and use .size. Cheaper than .count() at current scale.
        const memberCountsByTeamId = {}
        await Promise.all(teamsArr.map(async (team) => {
            const memSnap = await db.collection('teams').doc(team.id).collection('members').get()
            memberCountsByTeamId[team.id] = memSnap.size
        }))

        console.log('data retrieved', {
            teams: teamsArr.length,
            drops: dropsArr.length,
            profiles: profilesCount,
            totalMembersAcrossTeams: Object.values(memberCountsByTeamId).reduce((a, b) => a + b, 0),
        })

        this.cleanStats()
        this.stats.totalUsers = profilesCount
        this.verifyTownIdReconciliation(teamsArr, dropsArr)
        this.buildCountyBagsArrays(dropsArr)
        this.sortTeamsAndMembersToTowns(teamsArr, memberCountsByTeamId)
        this.getTotalTeams()
        createChoropleth()
        updateLabels()
        removeLoading()
        updateOdometer()
    }

    buildCountyBagsArrays(dropsArr) {
        this.townlessDropsCount = 0
        for (const drop of dropsArr) {
            const lng = drop.location && drop.location.coordinates && drop.location.coordinates.longitude
            const lat = drop.location && drop.location.coordinates && drop.location.coordinates.latitude

            // Resolution ladder: drop.location.townId → PIP on coordinates.
            let townKey = firestoreTownIdToTownKey(drop.location && drop.location.townId)
            if (!townKey) {
                townKey = townKeyForCoordinates(lng, lat)
            }

            const town = findTownByKey(this, townKey)
            if (town) {
                town.bagDrops.push(drop)
            } else {
                this.townlessDropsCount += 1
            }
        }
        this.getBagStats()
        console.log('vermont (after drops)', vermont, 'townless drops:', this.townlessDropsCount)
    }
    
    
    sortTeamsAndMembersToTowns(teamsArr, memberCountsByTeamId) {
        this.townlessTeamsArray = []
        for (const team of teamsArr) {
            // Resolution ladder: team.townId → team.locations[0].townId → PIP.
            let townKey = firestoreTownIdToTownKey(team.townId)
            if (!townKey && team.locations && team.locations[0]) {
                townKey = firestoreTownIdToTownKey(team.locations[0].townId)
            }
            if (!townKey && team.locations && team.locations[0] && team.locations[0].coordinates) {
                townKey = townKeyForCoordinates(
                    team.locations[0].coordinates.longitude,
                    team.locations[0].coordinates.latitude,
                )
            }

            const town = findTownByKey(this, townKey)
            if (town) {
                town.teams.push(team)
                town.users.push(memberCountsByTeamId[team.id] || 0)
            } else {
                this.townlessTeamsArray.push(team)
            }
        }
        for (const countyName in this.counties) {
            this.counties[countyName].getTeamAndUserStats()
        }
        console.log('populate finished. townless teams:', this.townlessTeamsArray.length)
    }

    getBagStats() {
        //set up an array to work with at the state level later.
        let stateBagCountArray = []
        //For each county
        for (let county in this.counties) {
            this.counties[county].getBagStats()
            stateBagCountArray.push(this.counties[county].stats.bagCount)
        }
        // sum up bag counts again. this time at the state level to get a total number of bags in the state.
        let stateBagCount = _.sum(stateBagCountArray)
        // 'Save' the total number of bags at the state level to a property of the Vermont Object.
        this.stats.bagCount = stateBagCount
    }
    
    //Gets the team count from each county and sums it to get the total teams in the state.
    getTotalTeams() {
        let teamCountArray = []
        for (let county in this.counties) {
            teamCountArray.push(this.counties[county].stats.totalTeams)
        } 
        let totalCountyTeams = _.sum(teamCountArray)
        this.stats.totalTeams = totalCountyTeams + this.townlessTeamsArray.length
        makeChart();


    }
    //Apparently each county in vermont has a number that refers just to that county.
    //This is a function that takes the County Number, listed for each town in our town polygons, and returns the county object that number corresponds to.
    countyNumber(CNTYNumber) {
        switch (CNTYNumber) {
            case 19:
            return this.counties.orleans
            break;
            case 13:
            return this.counties['grand isle']
            break;
            case 7:
            return this.counties.chittenden
            break;
            case 27:
            return this.counties.windsor
            break;
            case 25:
            return this.counties.windham
            break;
            case 3:
            return this.counties.bennington
            break;
            case 11:
            return this.counties.franklin
            break;
            case 9:
            return this.counties.essex
            break;
            case 15:
            return this.counties.lamoille
            break;
            case 5:
            return this.counties.caledonia
            break;
            case 17:
            return this.counties.orange
            break;
            case 23:
            return this.counties.washington
            break;
            case 21:
            return this.counties.rutland
            break;
            case 1:
            return this.counties.addison
            break;
        }
    }
    cleanStats(){
        this.stats = {
        }
        for (let county in this.counties){
            this.counties[county].cleanStats()
        }
    }
}
