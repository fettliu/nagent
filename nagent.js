#!/usr/bin/node
/*
                     ``                           
                     `.`.`                        
                      .yys                        
                       -:-``      ./:             
           .`.:  `      /++/.  ..``.`             
           ` -/`-//     ://:` -///`               
                `-.`-::` -/++/---.                
                   `-::.o*******+ .::.`+/          
                       .(nagent) `://: -.          
               ``  -::` +*******  ``              
               `.  os` -/:` `-///:-os+                
               `  ``       :/:`  `+o/`               
                          ...`       .`              
                          ``                   
 * fett 2019-2
*/
var local_port=0
var local_host='localhost'
var server_port=5670
var server_host='localhost'
var remote_port=0
var keep_conn_count=10
var conn_count=0
var runas_server=false
var client_timeout=60000*10
var service_timeout=60000*10
var net=require("net")


var log=function(){
	console.log("["+new Date().toLocaleString()+"]"+Array.prototype.join.call(arguments," "))
}
var log2=function(){
	console.log("["+new Date().toLocaleString()+"]"+Array.prototype.join.call(arguments," "))
}
var debug=e=>{}//log
var show=bf=>{return "["+bf.length+"]"+bf.toString()}

var argv=process.argv

// read config from file
try{
	var fs=require('fs')
	if(fs.existsSync("nagent.config")){
		text=fs.readFileSync('nagent.config',"utf8")
		eval(text)
	}
}catch(e){
	log("parse config file was failed!")
	log("append --help/-h for help")
	process.exit()
}

// parse command line
if(argv.length>2){
	let cur=2
	while(cur<argv.length){
		switch(argv[cur]){
			case "--help":
			case "-h":
				log("-p\t\t: need server open port.\n-h --help\t: this help.\n-P\t\t: local service port.")
				process.exit()
				break
			case "-p":
				remote_port=parseInt(argv[++cur])
				break
			case "-P":
				local_port=parseInt(argv[++cur])
				break
			case "-sp":
				server_port=parseInt(argv[++cur])
				break
			case "-s":
				runas_server=true
				++cur
				break
			default:cur++
		}
	}
}


if(!runas_server){// client chunk
if(local_port==0||remote_port==0){
	log("local port or server open port can't be 0, pls see help!")
	process.exit()
}

log("server open port:", remote_port)
log("local service port:", local_port)


// handling data
var handling_data=(sock,data)=>{
	if(!sock.partner){
		if(!sock.buffer)// save data for connect done
			sock.buffer=data
		else{
			sock.buffer=Buffer.concat([sock.buffer,data])
			return
		}
		partner = net.connect(local_port, local_host)
		conn_count--
		partner.on("connect", e=>{
			log("partner connect is done. port is", local_port)
			debug("s>>", show(sock.buffer))
			partner.write(sock.buffer)
			sock.partner=partner
		})
		partner.on("data", d=>{debug("s<<",show(d));sock.write(d)})
		partner.on("error", e=>{open_conn()}) 
		partner.on("end",e=>{log("partner is closed", local_port);sock.destroy()})
	}else{
		debug("s>>", show(data))
		sock.partner.write(data)
	}
}

// handling login
var handling_login=(sock,data)=>{
	if(data.toString()=="ok\r"){
		log("login is done.", sock.remoteAddress+":"+sock.remotePort)
		sock.on("data", d=>{handling_data(sock,d)})
	}else{
		log("login is failed.", sock.remoteAddress+":"+sock.remotePort, data.toString())
		sock.destroy()
	}
}

// open service
var open_conn=()=>{
	if(conn_count>=keep_conn_count)return
	var temp=net.connect(server_port, server_host)
	conn_count+=1
	log("connection count is", conn_count)
	temp.on("connect", e=>{
		log(temp.remoteAddress, temp.localPort, "connected!")
		temp.write("NAGENT1.0 guest nopwd "+remote_port+"\r")// protocal,username,password(can't include space char),open port
		temp.once("data", d=>{handling_login(temp,d)})
		if(conn_count<keep_conn_count)open_conn()
	})
	temp.setTimeout(client_timeout+parseInt((Math.random())*1000), e=>{//half hour
		conn_count--
		log("timeout")
		if(temp.partner)temp.partner.destroy()
		temp.destroy()
		open_conn()
	})
	temp.on("error", e=>{
		conn_count--;log(e.errno);setTimeout(open_conn, 1000)
	})
	temp.on("end", e=>{
		conn_count--
		log("connection is closed", temp.remotePort, "connnection count:", conn_count)
		if(temp.partner)temp.partner.destroy()
		setTimeout(open_conn, 1000)
	})
}

open_conn()

}else{// server chunk
var ports={}// port=>server(clients)
var debug=e=>{}//console.warn
fs=require("fs")
fd=fs.openSync("nagent-state", "w+")
var state=function(){
	let content=""
	for(let k in ports){
		let v = ports[k]
		let now = Date.now()
		if(v){
			let c2u=v.c2u_last,u2c=v.u2c_last,cc=v.c_conn,uc=v.u_conn
			let s1='▁▂▃▄▅▆▇█'[c2u>10240?7:c2u>8778?6:c2u>7316?5:c2u>5854?4:c2u>4392?3:c2u>2930?2:c2u>1468?1:0]
			let s2='▁▂▃▄▅▆▇█'[u2c>10240?7:u2c>8778?6:u2c>7316?5:u2c>5854?4:u2c>4392?3:u2c>2930?2:u2c>1468?1:0]
			let s3='▁▂▃▄▅▆▇█'[cc>21?7:cc>18?6:cc>15?5:cc>12?4:cc>9?3:cc>6?2:cc>3?1:0]
			let s4='▁▂▃▄▅▆▇█'[uc>21?7:uc>18?6:uc>15?5:uc>12?4:uc>9?3:uc>6?2:uc>3?1:0]
			head=k+"\t client:"+v.clients.length+" connections:"+v.conns.size+" "
			content+=head+s1+s2+" "+s3+s4+"\n"
			v.c2u_last=0
			v.u2c_last=0
			v.c_conn=0
			v.u_conn=0
		}
	}
	fs.writeSync(fd, content, 0)
}
setInterval(state, 1000)

// connection was closed
var disconnect=(s,reason)=>{
	s.destroy()
	log(s.port+" was closed", reason)
	if(s.client){
		if(s.server)s.server.conns.delete(s.client)
		s.client.destroy()
	}else if(s.partner){
		s.partner.destroy()
	}
	if(s.server){
		var ix = s.server.clients.indexOf(s)
		if(ix!=-1)s.server.clients.splice(ix,1)
		var port = s.server.port
		//console.log("disconnect local port is:", port)
		if(s.server.conns.size+s.server.clients.length==0){
			log("server was stop port is ", port)
			s.server.close()
			fs.truncateSync("nagent-state")
			delete ports[port]
		}
	}
}

// open port
var open_port=(port,c)=>{
	c.port=c.remotePort
	c.on("error", e=>{disconnect(c,"cerror")})
	if(ports[port]){
		server=ports[port]
		if(server.clients.length>=50){
			c.destroy()
			return
		}
		server.c_conn++
		c.server=server
		c.on("end", e=>{disconnect(c,"cend")})
		c.setTimeout(service_timeout+parseInt((Math.random())*1000), e=>{disconnect(c,"ctimeout")})
		server.clients.push(c)
		if(server.done)c.write("ok\r")
		return
	}
	console.log("open port...",port)
	var server=net.createServer()
	ports[port]=server
	server.done=false
	server.port=port
	server.clients=[c]
	server.conns=new Set()// store used connection
	server.listen(port)
	server.c2u_last=0
	server.u2c_last=0
	server.c_conn=1
	server.u_conn=0
	c.server=server
	c.on("end", e=>{disconnect(c,"cend2")})
	c.setTimeout(service_timeout+parseInt((Math.random())*1000), e=>{disconnect(c,"ctimeout2")})
	server.on("connection", u=>{
		u.port=u.remotePort
		log("new user at", u.remoteAddress+":"+u.remotePort+" to "+u.localPort)
		if(server.clients.length==0){
			log(port+"'u client is null")
			u.destroy()
			return
		}
		server.u_conn++
		u.client = server.clients.pop()
		u.client.partner = u
		u.server=server
		server.conns.add(u.client)
		log("alloc",u.client.port)
		u.client.on("data", d=>{
			server.c2u_last+=d.length
			try{u.write(d)}catch(e){}
		})
		u.on("data", d=>{u.client.write(d);server.u2c_last+=d.length})
		u.on("end", e=>{disconnect(u,"uend")})
		u.on("error", e=>{disconnect(u,"uerror")})
		u.setTimeout(service_timeout, e=>{disconnect(u,"utimeout")})
	})
	server.on("error", e=>{
		log("server on error", e.errno)
		process.exit()
		for(var cli of server.clients){
			cli.write("failed "+e.errno+"\r")
			cli.destroy()
		}
		delete ports[port]
	})
	server.on("listening", e=>{
		//log("listen successful.",port)
		server.done=true
		for(var cli of server.clients){
			//log("notify ok!", cli.remoteAddress, cli.remotePort)
			cli.write("ok\r")
		}
	})
}

var client_connect=c=>{
	c.on("data", d=>{
		try{
			s=d.toString()
			segs=s.slice(0,-1).split(" ")
			if(segs.length!=4 || segs[0]!="NAGENT1.0"){
				log("login failed",s)
				try{
				c.write("failed\r")
				c.destroy()
				}catch(e){}
				return
			}
		}catch(e){
			log("login exception:",e)
			c.write("except\r")
			c.destroy()
			return
		}
		//log("login successful!",segs[1])
		c.removeAllListeners()
		open_port(parseInt(segs[3]), c)
	})
	c.on("error",e=>{})
	c.setTimeout(1000, e=>{c.destroy()})
	log("new client", c.remotePort)
}

var server=net.createServer(client_connect)
server.listen(server_port)
log("service listen at", server_port)

}// server chunk
