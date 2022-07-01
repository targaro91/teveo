var listRange=["192.168.10.11/32"]

function checkRange(ip) {
    for(let i=0; i<listRange.length; i++){
        let arrRange=listRange[i].split("/")
        let range=arrRange[0]
        let max=arrRange[1]

        let arrayBinaryRangeIp=range.split(".")
        let binaryRangeIp=toBinary8bit(arrayBinaryRangeIp[0])+toBinary8bit(arrayBinaryRangeIp[1])+toBinary8bit(arrayBinaryRangeIp[2])+toBinary8bit(arrayBinaryRangeIp[3])
        let arrayBinaryIp=ip.split(".")        
        let binaryIp=toBinary8bit(arrayBinaryIp[0])+toBinary8bit(arrayBinaryIp[1])+toBinary8bit(arrayBinaryIp[2])+toBinary8bit(arrayBinaryIp[3])

        return binaryRangeIp.substring(0,range)===binaryIp.substring(0,range)
    }

}


function toBinary8bit(param){
    let num=parseInt(param)
    let bin=(num).toString(2)
    let dif=8-bin.length
    let complement=""
    for(let i=0; i < dif; i++)
        complement=complement+"0" 

    return complement+bin
}