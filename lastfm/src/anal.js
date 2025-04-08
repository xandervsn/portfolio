//overall | 7day | 1month | 3month | 6month | 12month 
function perchance(period, playtime, base){
    let time = 0;

    if(period == "period=overall&"){
        time = 10;
    }else if(period == "period=7day&"){
        time = 7*24*60*60
    }else if(period == "period=1month&"){
        time = 30*24*60*60
    }else if(period == "period=3month&"){
        time = 90*24*60*60
    }else if(period == "period=6month&"){
        time = 182*24*60*60
    }else if(period == "period=12month&"){
        time = 365*24*60*60
    }
    if(Math.round(base*100*(playtime/time))/base == 0){
        perchance(period, playtime, base*10)
    }else{
        return `${Math.round(base*100*(playtime/time))/base}%`
    }
}

function anal(total){
    const parent = new Date(total * 1000).toISOString().substring(5, 19);
    const seconds = parent.split(':')[2]
    const minutes = parent.split(':')[1]
    const hours = parent.substring(6, 8)
    const days = parent.substring(3, 5) - 1
    const months = parseInt(parent.substring(0, 2)) - 1
    let lettered = "";
    let analog = "";
    if (months > 0) {
        lettered = `${months} months, ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`
        analog = `${months}:${days}:${hours}:${minutes}:${seconds}`
    } else if (days > 0) {
        lettered = `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`
        analog = `${days}:${hours}:${minutes}:${seconds}`
    } else if (hours > 0) {
        lettered = `${hours} hours, ${minutes} minutes, ${seconds} seconds`
        analog = `${hours}:${minutes}:${seconds}`
    } else {
        lettered = `${minutes} minutes, ${seconds} seconds`
        analog = `${minutes}:${seconds}`
    }
    return `${lettered}`
}