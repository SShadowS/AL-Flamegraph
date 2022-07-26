# AL-Flamegraph

This service will generate either so-called folded files or SVG based on **.alcpuprofile** files from Business Central.

The SVGs are generated using [FlameGraph by Brendan Gregg](https://github.com/brendangregg/FlameGraph)

Quick note:
*This is made in Typescript by someone who rarely uses Typescript. But you got to start somewhere.*

**URL** : `/upload`

(Free webservice up at: http(s)://blogapi.sshadows.dk/upload)

**Method** : `POST`

**Header options** : 

Set the following header fields to trigger different output.
| Header field name | Description | Valid input | Only used for SVGs |
| ----------- | ----------- | ----------- | ----------- |
| filter | Which extentions to filter out from output | string |
| onlyfolded | Will just return the folded file, if not set then SVG will be generated | true or false |
| color | Select the color theme for the SVG | (none), hot, blue, aqua | *
| title | Sets the title for the SVG | any text intput | *
| subtitle | Sets the sub-title for the SVG | any text intput | *
| width | Sets the pixel width for the SVG | integer | *
| stripfileheader | Removes the initial XML part generate by flamegraph.pl script | true or false | *
| flamechart | If set to true, then exports flamechart instead of flamegraph | true or false | *
| fromunix | If set, will return the DateTime as Unix Time Stamp, in the response header | UTC DateTime |
| tounix | If set, will return the DateTime as Unix Time Stamp, in the response header | UTC DateTime |

**Auth required** : NO

**Permissions required** : None

**Data constraints**

The .alcpuprofile file in Body.

```json
{
        "nodes": [
        {
            "id": 1,
            "callFrame": {
                "functionName": "OnOpenPage",
                "scriptId": "Page_30",
                "url": "al-preview://allang/Page/30/Page_30.dal",
                "lineNumber": 2541,
                "columnNumber": 8
            },
            "hitCount": 1,
            "children": [
                2
            ],
            "declaringApplication": {
                "appName": "Base Application",
                "appPublisher": "Microsoft",
                "appVersion": "20.0.37253.38230"
            },
            "applicationDefinition": {
                "objectType": "Page",
                "objectName": "Item Card",
                "objectId": 30
            },
            "frameIdentifier": 268519315
        },
        {
            "id": 2,
            ...
}
```

**HTTP example**
```http
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

```bash
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

```
{
    Example pending
}
```
