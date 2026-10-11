export const radiusOptions=[1000,3000,5000,10000,25000];
export function approximateDistance(meters:number){return meters<1000?'Less than 1 km':`About ${Math.round(meters/1000)} km`;}
export function requestLocation(){return new Promise<GeolocationPosition>((resolve,reject)=>{
 if(!navigator.geolocation){reject(new Error('This browser does not support location access.'));return;}
 navigator.geolocation.getCurrentPosition(resolve,error=>{
  reject(new Error(error.code===1?'Location permission is required to find nearby users. Allow it in browser settings, then try again.':error.code===3?'Location request timed out. Try again when you have a clearer signal.':'Your current location is unavailable. Check your device location settings and try again.'));
 },{enableHighAccuracy:false,maximumAge:30000,timeout:12000});
});}
