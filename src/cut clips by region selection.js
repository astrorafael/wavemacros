// This macro cuts a clip given a region selection
// Usage: 
// 1. Select a range with the mouse.
// 2. Select the clip containing the click track 
// 3. Execute the macro

function splitMarkedRegion(old_method)
{
    var start = Tracktion.getPosition ('markIn');
    var end   = Tracktion.getPosition ('markOut');
    if ( ! old_method) {
        Tracktion.splitMarkedRegion();
    } else {
        Tracktion.setPosition ('cursor', start);
        Tracktion.splitClips();
        Tracktion.setPosition ('cursor', end);
        Tracktion.splitClips();
    }
    return [start, end];
}

function cutClipsByRegionSelection()
{
    var clips   = Tracktion.getSelectedEditElements ('clip');
    if (clips.length == 0) {
        Tracktion.showMessage('No clips selected');
        return;
    }
    var marks = splitMarkedRegion(true);
}
cutClipsByRegionSelection();
