// This macro inserts padding at the beginning of selected tracks
// This is necessary for the Groove Doctor not to shift clips
// in tracks where there are spaces.
// Usage: 
//   1. Select tracks in the track header.
//   2. Execute the macro.

function logTrack(track, i, clips)
{
    name = Tracktion.getName(track);
    Tracktion.log("Track[" + i + "] = " + name + " has " + clips.length + " clips");
}

function padTracks(tracks, start)
{
    for(var t = 0; t < tracks.length; ++t ) {
        name = Tracktion.getName(tracks[t]);
        Tracktion.log("Padding Track[" + t + "] name  (" + name + ")");
        Tracktion.deselectAll();
        Tracktion.addObjectsToSelection(tracks[t]);
        Tracktion.setPosition ('cursor', start);
        Tracktion.insertClip ('wave');
    }
}

function mergeAllClips(tracks)
{
    Tracktion.deselectAll();
    for(var t = 0; t < tracks.length; ++t ) {
        var clips = Tracktion.getClipsFromTracks (tracks[t]);
        logTrack(tracks[t], t, clips);
        for(var c = 0; c < clips.length; ++c ) {
            Tracktion.addObjectsToSelection(clips[c]);
            var clipName = Tracktion.getName(clips[c]);
            Tracktion.log("Processing Track " + t + ", clip " + c + " (" + clipName + ")");
            if (clipName === 'New Audio Clip') {
                var newName = Tracktion.getName(clips[c-1]);
                Tracktion.log("Setting clip " + c + " name to (" + newName + ")");
                Tracktion.setName (clips[c], newName);
            }
        } 
    }
    // Even though we have selected all clips, merge processing is per track
    Tracktion.mergeSelectedClips (true);
}

function selectedTracksPadding() {
 var tracks   = Tracktion.getSelectedEditElements ('track');
    if (tracks.length == 0) {
        Tracktion.showMessage('No tracks selected');
        return;
    }
    Tracktion.log("Selected " + tracks.length + " tracks");
    padTracks(tracks, 0);
    mergeAllClips(tracks);
}

selectedTracksPadding();
