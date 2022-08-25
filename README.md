# AL-Flamegraph

This service will generate either so-called folded files or SVG based on **.alcpuprofile** files from Business Central.

The SVGs are generated using [FlameGraph by Brendan Gregg](https://github.com/brendangregg/FlameGraph)


**URL** : `/upload`

**Method** : `POST`

**Header options** : 

Set the following header fields to trigger different output.
| Header field name | Description | Valid input | Only used for SVGs |
| ----------- | ----------- | ----------- | ----------- |
| onlyfolded | Will just return the folded file, if not set then SVG will be generated. | true or false |
| color | Select the color theme for the SVG | (none), hot, blue, aqua | *
| title | Sets the title for the SVG | any text intput | *
| subtitle | Sets the sub-title for the SVG | any text intput | *
| width | Sets the pixel width for the SVG | integer | *
| stripfileheader | Removes the initial XML part generate by flamegraph.pl script | true or false | *
| flamechart | If set to true, then exports flamechart instead of flamegraph | true or false | *


**Auth required** : NO

**Permissions required** : None

**Data constraints**

The .alcpuprofile file in Body.

```json
{
    Example pending
}
```

**HTTP example**
```
POST /upload HTTP/1.1
Host: blogapi.sshadows.dk
StripFileHeader: false
color: aqua
width: 1800
Content-Type: application/octet-stream
Content-Length: 22

"<file contents here>"
```
**cURL example**

```
curl --location --request POST 'http://blogapi.sshadows.dk/upload' 
--header 'StripFileHeader: false' 
--header 'color: aqua' 
--header 'width: 1800' 
--header 'Content-Type: application/octet-stream' 
--data-binary '@/c:/temp/PerformanceProfile_Session4.alcpuprofile'
```

## Success Response

**Code** : `200`

**Content example**

```svg
{
    Example pending
}
```