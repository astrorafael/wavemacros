// --------------------------------------------------------------------
// This macro exports Groove Doctor's transients as Transcribe! markers
// Usage:
// 1. Select clip in Clict Track
// 2. Execute Groove Doctor's Extract Groove so that transients are highlighted
// 3. Execute this macro with Groove Doctor stil open
// 4. Search in the logfile all the marks
// 5. Edit the marsk, stripping out the timestamp
// 6. paste the etxt ino an .xsc Transcribe file
// --------------------------------------------------------------------

function formatTransient(seconds, isBar, M) 
{
    seconds = parseFloat(seconds);
    var HH = Math.floor(seconds / 3600);
    var MM = Math.floor((seconds - HH*3600) / 60);
    var SS = seconds - (HH*3600 + MM*60);
    if (isBar) {
        Tracktion.log("M,-1,1," + M + ",0," + HH + ':' + MM + ':' + SS);
    } else {
        Tracktion.log("B,-1,1,,0," + HH + ':' + MM + ':' + SS);
    } 
}

function exportTransients(N)
{
    var transients = Tracktion.getTransients();
    if (transients.length == 0) {
        Tracktion.showMessage ('No transients. Use Groove Dr. to detect transients');
        return;
    }
    Tracktion.log("SectionStart,Markers");
    Tracktion.log("Howmany," + transients.length);

    var Meas = 1;

    for(var t=0; t < transients.length; ++t) {
      var isBar = (t % N) == 0 ? true : false;
      var barNumber = (t / N) + 1
      var transient = transients[t];
      formatTransient(transient, isBar, barNumber);
    }
    Tracktion.log("SectionEnd,Markers");

  
}
exportTransients(4);
